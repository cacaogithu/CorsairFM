import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Calculate text similarity using Levenshtein distance
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 100;
  
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 100;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return ((longer.length - editDistance) / longer.length) * 100;
}

// Find best match of needle in haystack using fuzzy matching
function findBestMatch(needle: string, haystack: string): number {
  const needleLower = needle.toLowerCase().trim();
  const haystackLower = haystack.toLowerCase().trim();
  
  // Check if exact substring exists
  if (haystackLower.includes(needleLower)) {
    return 100;
  }
  
  // Split into words and find best matching sequence
  const needleWords = needleLower.split(/\s+/);
  const haystackWords = haystackLower.split(/\s+/);
  
  let bestScore = 0;
  
  // Try all possible sequences of the same length
  for (let i = 0; i <= haystackWords.length - needleWords.length; i++) {
    const sequence = haystackWords.slice(i, i + needleWords.length).join(' ');
    const score = calculateSimilarity(needleLower, sequence);
    bestScore = Math.max(bestScore, score);
  }
  
  // Also check similarity with full haystack if it's short
  if (haystackWords.length <= needleWords.length + 2) {
    const fullScore = calculateSimilarity(needleLower, haystackLower);
    bestScore = Math.max(bestScore, fullScore);
  }
  
  return bestScore;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { projectId } = await req.json();

    console.log('Starting image processing for project:', projectId);

    // Get all queued images for this project
    const { data: images, error: fetchError } = await supabase
      .from('images')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'queued')
      .order('image_number');

    if (fetchError) {
      throw new Error(`Failed to fetch images: ${fetchError.message}`);
    }

    if (!images || images.length === 0) {
      console.log('No queued images found');
      return new Response(
        JSON.stringify({ message: 'No images to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${images.length} images to process`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      
      // Update project status to failed
      await supabase
        .from('projects')
        .update({ status: 'failed' })
        .eq('id', projectId);
      
      // Mark all queued images as failed
      await supabase
        .from('images')
        .update({ 
          status: 'failed', 
          error_message: 'AI service not configured. Please contact support.' 
        })
        .eq('project_id', projectId)
        .eq('status', 'queued');
      
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Process images in parallel with batching
    const BATCH_SIZE = 10;
    const processImageWithRetry = async (image: any) => {
      let retryCount = image.retry_count || 0;
      let shouldRetry = true;
      let finalEditedUrl = '';
      let finalOcrText = '';
      let finalSimilarityScore = 0;
      
      while (shouldRetry && retryCount <= 2) {
        try {
          console.log(`Processing image ${image.image_number} (attempt ${retryCount + 1}): ${image.original_filename}`);

          // Update status to processing
          await supabase
            .from('images')
            .update({ status: 'processing', retry_count: retryCount })
            .eq('id', image.id);

          const startTime = Date.now();

        // Generate edited image with enhanced prompt structure
        const enhancedPrompt = `You are a professional graphic designer. Your task is to add text overlays to a product image with PERFECT accuracy.

CRITICAL TEXT ACCURACY REQUIREMENTS:
${retryCount > 0 ? `⚠️ RETRY ${retryCount + 1}/3 - Previous attempt had ${100 - finalSimilarityScore}% error rate!\n` : ''}

EXACT TEXT TO RENDER:
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Title (large, bold, top): "${image.title}"
Character count: ${image.title.length}
Character-by-character: ${image.title.split('').join(' • ')}

Subtitle (smaller, below title): "${image.subtitle}"
Character count: ${image.subtitle.length}
${image.subtitle.length > 100 ? 'IMPORTANT: Full subtitle is long. Fit as much as possible while maintaining readability.\n' : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━

DESIGN INSTRUCTIONS:
${image.ai_prompt}

VERIFICATION CHECKLIST:
✓ Title has exactly ${image.title.length} characters
✓ Subtitle has exactly ${image.subtitle.length} characters  
✓ Every letter, number, space, and punctuation mark is correct
✓ Text is legible and high-contrast against background

Return the edited image with ZERO text errors.`;

          console.log(`Processing image ${image.image_number} with title: "${image.title}"`);

          const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash-image-preview',
              messages: [
                {
                  role: 'user',
                  content: [
                    {
                      type: 'text',
                      text: enhancedPrompt
                    },
                    {
                      type: 'image_url',
                      image_url: {
                        url: image.original_url
                      }
                    }
                  ]
                }
              ],
              modalities: ['image', 'text']
            }),
          });

          if (!aiResponse.ok) {
            const errorText = await aiResponse.text();
            console.error(`Lovable AI error (${aiResponse.status}):`, errorText);
            throw new Error(`Lovable AI API error: ${aiResponse.statusText}`);
          }

          const aiData = await aiResponse.json();
          console.log('Lovable AI (Nano Banana) response received for image', image.image_number);
          
          // Extract base64 image from Lovable AI response
          const base64Image = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          
          if (!base64Image) {
            throw new Error('No image returned from Lovable AI');
          }

          // Convert base64 to blob and upload to storage
          const base64Data = base64Image.split(',')[1];
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'image/jpeg' });

          // Upload to edited-images bucket
          const editedFileName = `${projectId}/${image.id}_edited_v${retryCount + 1}.jpg`;
          const { error: uploadError } = await supabase
            .storage
            .from('edited-images')
            .upload(editedFileName, blob, {
              contentType: 'image/jpeg',
              upsert: true
            });

          if (uploadError) {
            throw new Error(`Failed to upload edited image: ${uploadError.message}`);
          }

          // Get public URL
          const { data: urlData } = supabase
            .storage
            .from('edited-images')
            .getPublicUrl(editedFileName);

          const editedUrl = urlData.publicUrl;
          console.log(`Image ${image.image_number} uploaded successfully`);

          // ===== OCR VALIDATION =====
          console.log(`Running OCR validation for image ${image.image_number}...`);
          
          const ocrResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
                  content: [
                    {
                      type: 'text',
                      text: `Extract ALL visible text from this image. 
      
Expected to find:
- Title: "${image.title}"
- Subtitle: "${image.subtitle}"

Return the extracted text exactly as you see it, including all words, numbers, and punctuation. Preserve line breaks and formatting.`
                    },
                    {
                      type: 'image_url',
                      image_url: { url: base64Image }
                    }
                  ]
                }
              ]
            })
          });

          if (!ocrResponse.ok) {
            console.error('OCR validation failed, skipping validation');
            finalEditedUrl = editedUrl;
            shouldRetry = false;
            break;
          }

          const ocrData = await ocrResponse.json();
          const extractedText = ocrData.choices?.[0]?.message?.content || '';
          
          console.log(`OCR extracted text: "${extractedText}"`);
          
          // Use fuzzy matching to find title and subtitle in extracted text
          const titleAccuracy = findBestMatch(image.title, extractedText);
          const subtitleAccuracy = findBestMatch(image.subtitle, extractedText);
          const overallAccuracy = (titleAccuracy + subtitleAccuracy) / 2;
          
          console.log('OCR Comparison:');
          console.log('Expected Title:', image.title);
          console.log('Expected Subtitle:', image.subtitle);
          console.log('Extracted Text:', extractedText);
          console.log('Title Match:', titleAccuracy.toFixed(1), '%');
          console.log('Subtitle Match:', subtitleAccuracy.toFixed(1), '%');
          console.log('Overall:', overallAccuracy.toFixed(1), '%');

          finalEditedUrl = editedUrl;
          finalOcrText = extractedText;
          finalSimilarityScore = overallAccuracy;

          // Update with OCR results including retry history
          const retryHistoryItem = { 
            attempt: retryCount + 1, 
            accuracy: overallAccuracy, 
            timestamp: new Date().toISOString() 
          };
          
          const currentRetryHistory = image.retry_history || [];
          const updatedRetryHistory = [...currentRetryHistory, retryHistoryItem];

          await supabase
            .from('images')
            .update({ 
              ocr_extracted_text: extractedText,
              text_accuracy_score: overallAccuracy,
              retry_history: updatedRetryHistory
            })
            .eq('id', image.id);

          // Early exit if accuracy is excellent
          if (overallAccuracy >= 90) {
            console.log(`Excellent accuracy (${overallAccuracy.toFixed(1)}%), skipping retries`);
            shouldRetry = false;
          }
          // Check if we need to retry with more lenient threshold
          else if (overallAccuracy < 70 && retryCount < 2) {
            console.log(`Low accuracy (${overallAccuracy.toFixed(1)}%), retrying...`);
            retryCount++;
            shouldRetry = true;
          } else {
            shouldRetry = false;
          }

          const processingTime = Date.now() - startTime;

          // Update image with results
          await supabase
            .from('images')
            .update({
              edited_url: finalEditedUrl,
              status: 'completed',
              processing_time_ms: processingTime,
              ocr_extracted_text: finalOcrText,
              text_accuracy_score: finalSimilarityScore,
              needs_review: finalSimilarityScore < 90,
              retry_count: retryCount,
            })
            .eq('id', image.id);

          console.log(`Image ${image.image_number} completed with ${finalSimilarityScore.toFixed(1)}% accuracy after ${retryCount + 1} attempt(s)`);

        } catch (attemptError) {
          console.error(`Error on attempt ${retryCount + 1} for image ${image.id}:`, attemptError);
          
          // If this was the last retry, mark as failed
          if (retryCount >= 2) {
            const errorMessage = attemptError instanceof Error ? attemptError.message : 'Unknown error';
            await supabase
              .from('images')
              .update({
                status: 'failed',
                error_message: errorMessage,
                retry_count: retryCount,
              })
              .eq('id', image.id);
            shouldRetry = false;
          } else {
            // Try again
            retryCount++;
          }
        }
      }

      return { success: shouldRetry === false, imageId: image.id };
    };

    // Process images in batches
    const results = [];
    for (let i = 0; i < images.length; i += BATCH_SIZE) {
      const batch = images.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(images.length / BATCH_SIZE)} (${batch.length} images)`);
      
      const batchResults = await Promise.allSettled(
        batch.map(img => processImageWithRetry(img))
      );
      
      results.push(...batchResults);
      
      // Update project progress after each batch
      const completedCount = results.filter(r => r.status === 'fulfilled').length;
      const { data: project } = await supabase
        .from('projects')
        .select('total_images')
        .eq('id', projectId)
        .single();
      
      if (project) {
        await supabase
          .from('projects')
          .update({
            completed_images: completedCount,
            status: completedCount >= project.total_images ? 'completed' : 'processing_images',
          })
          .eq('id', projectId);
      }
    }

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failureCount = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;
    
    console.log(`Parallel processing completed: ${successCount} succeeded, ${failureCount} failed`);

    return new Response(
      JSON.stringify({ success: true, processed: images.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-images:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
