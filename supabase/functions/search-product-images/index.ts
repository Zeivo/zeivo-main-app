import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const VERTEX_AI_API_KEY = Deno.env.get('VERTEX_AI_API_KEY');
    const UNSPLASH_ACCESS_KEY = Deno.env.get('UNSPLASH_ACCESS_KEY');

    if (!UNSPLASH_ACCESS_KEY) {
      throw new Error('UNSPLASH_ACCESS_KEY not configured');
    }

    console.log('Fetching products without images...');

    // Get products without images
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, category')
      .or('image.is.null,image.eq.');

    if (productsError) {
      throw productsError;
    }

    console.log(`Found ${products?.length || 0} products without images`);

    const results = [];

    for (const product of products || []) {
      console.log(`Searching images for: ${product.name}`);

      try {
        // Search for product images on Unsplash
        const searchQuery = encodeURIComponent(product.name);
        const unsplashUrl = `https://api.unsplash.com/search/photos?query=${searchQuery}&per_page=5&orientation=landscape`;
        
        const unsplashResponse = await fetch(unsplashUrl, {
          headers: {
            'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`
          }
        });

        if (!unsplashResponse.ok) {
          console.error(`Unsplash API error for ${product.name}: ${unsplashResponse.status}`);
          continue;
        }

        const unsplashData = await unsplashResponse.json();
        
        if (!unsplashData.results || unsplashData.results.length === 0) {
          console.log(`No images found for ${product.name}`);
          continue;
        }

        // Use Vertex AI to select the best image if available
        let selectedImageUrl = unsplashData.results[0].urls.regular;

        if (VERTEX_AI_API_KEY && unsplashData.results.length > 1) {
          try {
            const projectId = 'zeivo-477017';
            const location = 'europe-west4';
            const model = 'gemini-2.5-flash';
            
            const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

            const imageDescriptions = unsplashData.results
              .slice(0, 3)
              .map((img: any, idx: number) => 
                `${idx}: ${img.alt_description || 'No description'} (${img.urls.regular})`
              )
              .join('\n');

            const aiResponse = await fetch(endpoint, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'x-goog-api-key': VERTEX_AI_API_KEY
              },
              body: JSON.stringify({
                contents: [{
                  role: 'user',
                  parts: [{ 
                    text: `Product: ${product.name}\n\nSelect the best image index (0-2) that matches this product:\n${imageDescriptions}\n\nReturn only the index number.`
                  }]
                }],
                generationConfig: {
                  temperature: 0
                }
              })
            });

            if (aiResponse.ok) {
              const aiData = await aiResponse.json();
              const selectedIndex = parseInt(aiData.candidates?.[0]?.content?.parts?.[0]?.text || '0');
              if (!isNaN(selectedIndex) && selectedIndex >= 0 && selectedIndex < unsplashData.results.length) {
                selectedImageUrl = unsplashData.results[selectedIndex].urls.regular;
                console.log(`AI selected image ${selectedIndex} for ${product.name}`);
              }
            }
          } catch (aiError) {
            console.error('AI selection error:', aiError);
            // Continue with first image
          }
        }

        // Update product with selected image
        const { error: updateError } = await supabase
          .from('products')
          .update({ image: selectedImageUrl })
          .eq('id', product.id);

        if (updateError) {
          console.error(`Failed to update image for ${product.name}:`, updateError);
        } else {
          console.log(`✓ Found and saved image for ${product.name}`);
          results.push({
            product: product.name,
            image_url: selectedImageUrl,
            success: true
          });
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Error searching image for ${product.name}:`, error);
        results.push({
          product: product.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        results,
        message: `Found ${results.filter(r => r.success).length} images`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Error in search-product-images:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
