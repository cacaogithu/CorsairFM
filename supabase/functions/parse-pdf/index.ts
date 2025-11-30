import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfUrl, brandSettings } = await req.json();

    console.log('Starting PDF parsing for URL:', pdfUrl);

    // Decode the URL to handle double-encoding issues
    const decodedUrl = decodeURIComponent(pdfUrl);
    console.log('Decoded URL:', decodedUrl);

    // Download PDF content
    const pdfResponse = await fetch(decodedUrl);
    
    if (!pdfResponse.ok) {
      const errorText = await pdfResponse.text();
      console.error('Failed to fetch PDF:', pdfResponse.status, errorText);
      throw new Error(`Failed to fetch PDF: ${pdfResponse.status} - ${errorText}`);
    }
    
    const pdfBuffer = await pdfResponse.arrayBuffer();
    console.log('PDF downloaded, size:', pdfBuffer.byteLength, 'bytes');
    
    // Extract text using TextDecoder
    const pdfText = new TextDecoder().decode(pdfBuffer);
    
    // Extract readable text by finding text between BT and ET (text blocks in PDF)
    const textBlocks: string[] = [];
    const btPattern = /BT\s+(.*?)\s+ET/gs;
    let match;
    
    while ((match = btPattern.exec(pdfText)) !== null) {
      // Extract text from PDF commands like (text) Tj or [(text)] TJ
      const block = match[1];
      const textPattern = /\(([^)]+)\)/g;
      let textMatch;
      
      while ((textMatch = textPattern.exec(block)) !== null) {
        const text = textMatch[1]
          .replace(/\\n/g, ' ')
          .replace(/\\r/g, ' ')
          .replace(/\\t/g, ' ')
          .trim();
        
        if (text && text.length > 2) {
          textBlocks.push(text);
        }
      }
    }
    
    const fullText = textBlocks.join(' ');
    console.log('Extracted text length:', fullText.length);
    console.log('Extracted text preview:', fullText.slice(0, 500));
    
    // If text is too long (>500k chars = ~125k tokens), truncate intelligently
    let processedText = fullText;
    if (fullText.length > 500000) {
      // Keep first 400k and last 100k characters to preserve important info
      processedText = fullText.slice(0, 400000) + '\n\n[...middle content truncated...]\n\n' + fullText.slice(-100000);
      console.log('Truncated text to avoid token limit. New length:', processedText.length);
    }

    // Use Lovable AI (Gemini) to parse PDF natively
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    // Platform-specific requirements
    const platformRequirements: Record<string, string> = {
      amazon: "Amazon requirements: Main image must be on pure white background, text must be clear and readable at thumbnail size, ensure high contrast. Product should occupy 85% of frame.",
      ebay: "eBay requirements: Clean background, prominent product display, text should be bold and eye-catching. Include key product features in visible text.",
      instagram: "Instagram requirements: Square or 4:5 aspect ratio friendly, vibrant colors, text should be mobile-friendly and readable on small screens. Aesthetic and lifestyle-oriented presentation.",
    };

    const platformPrompt = brandSettings.platform && brandSettings.platform !== 'none' 
      ? ` ${platformRequirements[brandSettings.platform] || ''}` 
      : '';

    const promptText = `# Role
You are an AI creative assistant specialized in extracting marketing image specifications from briefs.

Your task is to read the provided PDF brief and extract each image specification into structured JSON format.

## Instructions

1. Extract ALL images mentioned in the brief (IMAGE 1, IMAGE 2, IMAGE 3, etc.)
2. IMPORTANT: Each IMAGE section may have MULTIPLE variants (METAL DARK, WOOD DARK, etc.). Create a SEPARATE JSON entry for EACH variant.
3. For each image variant, extract:
   - image_number: The IMAGE number (1, 2, 3, etc.) - this is the same for all variants of that image
   - title: The HEADLINE text (convert to uppercase if not already)
   - subtitle: The COPY text (keep as written, preserve full text)
   - asset: The ASSET filename specified for that variant
   - variant: Either "METAL DARK" or "WOOD DARK" (or other variants if specified)

4. For the ai_prompt field, generate a plain text instruction (no markdown, no line breaks) using this template:

"Add a dark gradient overlay to the top portion of this image, fading from ${brandSettings.gradientColor || '#000000'} at the top to transparent around the middle. The gradient should be subtle and natural looking. Overlay the following text at the top center of the image: {title} in large bold ${brandSettings.textColor || 'white'} text (${brandSettings.font || 'Montserrat'} Extra Bold font, approximately 48-60px, all caps), and below it {subtitle} in smaller regular ${brandSettings.textColor || 'white'} text (${brandSettings.font || 'Montserrat'} Regular font, approximately 18-22px). Add a subtle shadow behind the text for readability. Keep the product and background unchanged.${brandSettings.customPrompt ? ' ' + brandSettings.customPrompt : ''}${platformPrompt} Output as a high-resolution image suitable for web marketing."

Replace {title} and {subtitle} with the actual extracted values.

5. Return ONLY a valid JSON array, no additional text or markdown formatting.

## Output Example

[
  {
    "image_number": 2,
    "variant": "METAL DARK",
    "title": "CORSAIR ONE I600",
    "subtitle": "A Compact PC packed with cutting-edge components and excellent performance.",
    "asset": "CORSAIR_ONE_i600_DARK_METAL_12",
    "ai_prompt": "Add a dark gradient overlay to the top portion of this image..."
  },
  {
    "image_number": 2,
    "variant": "WOOD DARK",
    "title": "CORSAIR ONE I600",
    "subtitle": "A Compact PC packed with cutting-edge components and excellent performance.",
    "asset": "CORSAIR_ONE_i600_WOOD_DARK_PHOTO_17",
    "ai_prompt": "Add a dark gradient overlay to the top portion of this image..."
  }
]

Please process the PDF and return the JSON array.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: `${promptText}\n\nPDF Content:\n${processedText}`
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status} - ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0].message.content;
    
    console.log('AI response received:', content.substring(0, 500));

    // Parse JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found in AI response');
    }

    const parsedImages: ParsedImage[] = JSON.parse(jsonMatch[0]);
    
    console.log(`Successfully parsed ${parsedImages.length} images from PDF`);

    return new Response(
      JSON.stringify({ images: parsedImages }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error parsing PDF:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
