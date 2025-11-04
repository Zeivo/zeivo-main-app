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

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
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
      console.log(`Generating image for: ${product.name}`);

      try {
        // Generate product image using Gemini
        const prompt = `Create a professional, high-quality product photography image of a ${product.name}. 
        The image should be on a clean white background, well-lit with studio lighting, showing the product from a 
        front-facing angle. Make it look like an official product image from an e-commerce website. 
        High resolution, 16:9 aspect ratio.`;

        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image-preview",
            messages: [
              {
                role: "user",
                content: prompt
              }
            ],
            modalities: ["image", "text"]
          })
        });

        if (!response.ok) {
          console.error(`Failed to generate image for ${product.name}: ${response.status}`);
          continue;
        }

        const data = await response.json();
        const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (!imageUrl) {
          console.error(`No image URL in response for ${product.name}`);
          continue;
        }

        // Update product with generated image
        const { error: updateError } = await supabase
          .from('products')
          .update({ image: imageUrl })
          .eq('id', product.id);

        if (updateError) {
          console.error(`Failed to update image for ${product.name}:`, updateError);
        } else {
          console.log(`✓ Generated and saved image for ${product.name}`);
          results.push({
            product: product.name,
            success: true
          });
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`Error generating image for ${product.name}:`, error);
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
        message: `Generated ${results.filter(r => r.success).length} images`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Error in generate-product-images:', error);
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
