import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, imageId, title, subtitle, basePrompt } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    console.log(`Analyzing image ${imageId} for optimal text placement...`);
    
    const analysisPrompt = `Analyze this product image and provide recommendations for adding text overlay.

The text to be added:
- Title: "${title}"
- Subtitle: "${subtitle}"

Analyze:
1. Where should the text be positioned for maximum readability? (top, middle, bottom, left, right, center)
2. What background elements are present that might interfere with text?
3. Should the gradient be darker/lighter than usual?
4. Is there already text in the image? If so, where?
5. What font size would work best given the image composition?

Respond in JSON format:
{
  "position": "top-center",
  "gradient_intensity": "medium",
  "existing_text_areas": ["bottom-right logo"],
  "recommended_font_size_title": "52px",
  "recommended_font_size_subtitle": "20px",
  "placement_notes": "Product occupies center, safe to place text at top"
}`;

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
            content: [
              { type: 'text', text: analysisPrompt },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ]
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI analysis failed:', errorText);
      throw new Error('Failed to analyze image');
    }

    const aiData = await aiResponse.json();
    const responseText = aiData.choices[0].message.content;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      console.error('No JSON found in response:', responseText);
      return new Response(
        JSON.stringify({ enhanced_prompt: basePrompt }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const analysis = JSON.parse(jsonMatch[0]);
    
    // Enhance the base prompt with analysis insights
    const enhancedPrompt = `${basePrompt}

IMPORTANT PLACEMENT GUIDANCE based on image analysis:
- Position: ${analysis.position}
- Gradient intensity: ${analysis.gradient_intensity}
- Title size: ${analysis.recommended_font_size_title}
- Subtitle size: ${analysis.recommended_font_size_subtitle}
- Notes: ${analysis.placement_notes}
${analysis.existing_text_areas.length > 0 ? `- Avoid these areas with existing text: ${analysis.existing_text_areas.join(', ')}` : ''}`;

    console.log(`Analysis complete for image ${imageId}`);

    return new Response(
      JSON.stringify({ 
        enhanced_prompt: enhancedPrompt,
        analysis 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error analyzing image:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
