import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import * as zip from "https://deno.land/x/zipjs@v2.7.34/index.js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParsedImage {
  image_number: number;
  variant: string;
  title: string;
  subtitle: string;
  asset: string;
  ai_prompt: string;
}

interface ExtractedImage {
  filename: string;
  url: string;
  originalName: string;
  documentOrder: number; // Order in which image appears in document
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { docxUrl, brandSettings, projectId } = await req.json();
    
    console.log('Starting DOCX parsing and image extraction for:', docxUrl);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Download DOCX file
    const docxResponse = await fetch(decodeURIComponent(docxUrl));
    if (!docxResponse.ok) {
      throw new Error(`Failed to download DOCX: ${docxResponse.statusText}`);
    }

    const docxBlob = await docxResponse.blob();
    const docxBuffer = await docxBlob.arrayBuffer();
    
    // DOCX files are ZIP archives - extract text and images
    const zipReader = new (zip as any).ZipReader(new (zip as any).BlobReader(new Blob([docxBuffer])));
    const entries = await zipReader.getEntries();
    
    console.log(`Found ${entries.length} entries in DOCX`);
    
    // Extract text from document.xml and track image order
    let extractedText = '';
    let documentXml = '';
    const documentEntry = entries.find((entry: any) => entry.filename === 'word/document.xml');
    
    if (documentEntry && documentEntry.getData) {
      const textWriter = new (zip as any).TextWriter();
      documentXml = await documentEntry.getData(textWriter);
      
      // Parse XML to extract text
      const textMatches = documentXml.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) || [];
      extractedText = textMatches
        .map((match: string) => match.replace(/<[^>]+>/g, ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      console.log('Extracted text length:', extractedText.length);
    }

    if (!extractedText || extractedText.length < 50) {
      throw new Error('DOCX appears empty or could not be parsed');
    }

    // Parse document.xml to track image order via relationship references
    const imageOrderMap = new Map<string, number>();
    if (documentXml) {
      // Find all drawing/picture references in document order
      const drawingRefs = documentXml.match(/<a:blip[^>]+r:embed="([^"]+)"/g) || [];
      drawingRefs.forEach((ref, index) => {
        const rIdMatch = ref.match(/r:embed="([^"]+)"/);
        if (rIdMatch) {
          imageOrderMap.set(rIdMatch[1], index + 1);
        }
      });
      console.log(`Found ${imageOrderMap.size} image references in document order`);
    }

    // Parse relationships to map rIds to actual filenames
    const relsEntry = entries.find((entry: any) => entry.filename === 'word/_rels/document.xml.rels');
    const rIdToFilename = new Map<string, string>();
    
    if (relsEntry && relsEntry.getData) {
      const textWriter = new (zip as any).TextWriter();
      const relsXml = await textWriter && await relsEntry.getData(textWriter);
      const relationshipMatches = relsXml.match(/<Relationship[^>]+>/g) || [];
      
      relationshipMatches.forEach((rel: string) => {
        const idMatch = rel.match(/Id="([^"]+)"/);
        const targetMatch = rel.match(/Target="([^"]+)"/);
        if (idMatch && targetMatch && targetMatch[1].includes('media/')) {
          const filename = targetMatch[1].split('/').pop();
          if (filename) {
            rIdToFilename.set(idMatch[1], filename);
          }
        }
      });
      console.log(`Mapped ${rIdToFilename.size} relationship IDs to filenames`);
    }

    // Extract embedded images from word/media/
    const extractedImages: ExtractedImage[] = [];
    const imageEntries = entries.filter((entry: any) => 
      entry.filename.startsWith('word/media/') && 
      /\.(png|jpg|jpeg|gif|bmp)$/i.test(entry.filename)
    );

    console.log(`Found ${imageEntries.length} embedded images`);

    for (let i = 0; i < imageEntries.length; i++) {
      const imageEntry = imageEntries[i];
      const originalName = imageEntry.filename.split('/').pop() || `image_${i + 1}`;
      
      // Find document order for this image
      let documentOrder = i + 1; // Default to extraction order
      for (const [rId, filename] of rIdToFilename.entries()) {
        if (filename === originalName && imageOrderMap.has(rId)) {
          documentOrder = imageOrderMap.get(rId)!;
          break;
        }
      }
      
      console.log(`Extracting image: ${originalName} (document order: ${documentOrder})`);
      
      if (imageEntry.getData) {
        const blobWriter = new (zip as any).BlobWriter();
        const imageBlob = await imageEntry.getData(blobWriter);
        const imageBuffer = await imageBlob.arrayBuffer();
        
        // Determine file extension
        const ext = originalName.split('.').pop()?.toLowerCase() || 'jpg';
        const filename = `${projectId}/extracted_${i + 1}.${ext}`;
        
        // Upload to Supabase storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('original-images')
          .upload(filename, imageBuffer, {
            contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
            upsert: true
          });
        
        if (uploadError) {
          console.error(`Failed to upload ${originalName}:`, uploadError);
          continue;
        }
        
        const { data: { publicUrl } } = supabase.storage
          .from('original-images')
          .getPublicUrl(filename);
        
        extractedImages.push({
          filename: filename.split('/').pop() || originalName,
          url: publicUrl,
          originalName,
          documentOrder
        });
        
        console.log(`Uploaded image ${i + 1}: ${publicUrl} (order: ${documentOrder})`);
      }
    }

    await zipReader.close();

    // Truncate text if too long
    const maxChars = 100000;
    const textToAnalyze = extractedText.length > maxChars 
      ? extractedText.substring(0, maxChars) + '\n\n[Text truncated due to length...]'
      : extractedText;

    // Build prompt with brand settings
    const fontInstruction = brandSettings?.font 
      ? `Use ${brandSettings.font} font family.` 
      : 'Use a clean, modern sans-serif font.';
    
    const colorInstructions = brandSettings?.primaryColor || brandSettings?.textColor
      ? `Primary color: ${brandSettings.primaryColor || '#000000'}, Text color: ${brandSettings.textColor || '#FFFFFF'}`
      : 'Use high-contrast, professional colors';

    const platformInstruction = brandSettings?.platform
      ? `Optimize for ${brandSettings.platform} platform.`
      : 'Optimize for web marketing.';

    const customInstructions = brandSettings?.customPrompt || '';

    const systemPrompt = `You are a marketing brief analyzer. Extract image specifications from this DOCX document.

BRAND GUIDELINES:
- ${fontInstruction}
- ${colorInstructions}
- ${platformInstruction}
${customInstructions ? `- Custom: ${customInstructions}` : ''}

For each image specification, return a JSON object with:
- image_number: sequential number (1, 2, 3, etc.)
- variant: product variant (e.g., "METAL DARK", "WOOD LIGHT", or "DEFAULT" if not specified)
- title: main headline text (uppercase)
- subtitle: secondary text (preserve full text)
- asset: asset/product name or filename reference
- ai_prompt: detailed instructions for AI image generation

IMPORTANT: If the document references ${extractedImages.length} images, create ${extractedImages.length} specifications.

Return ONLY a valid JSON array, no markdown formatting.`;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: textToAnalyze }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI API request failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content;

    if (!aiResponse) {
      throw new Error('No response from AI');
    }

    console.log('AI response:', aiResponse.substring(0, 500));

    // Parse JSON from response
    const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Could not extract JSON array from AI response');
    }

    const parsedImages: ParsedImage[] = JSON.parse(jsonMatch[0]);

    console.log(`Successfully parsed ${parsedImages.length} image specs and extracted ${extractedImages.length} images from DOCX`);

    return new Response(
      JSON.stringify({ 
        images: parsedImages,
        extractedImages: extractedImages
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error parsing DOCX:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});