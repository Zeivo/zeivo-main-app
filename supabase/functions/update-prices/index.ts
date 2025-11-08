import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Product {
  id: string;
  name: string;
  slug: string;
  category: string;
  brand?: string;
}

interface MerchantListing {
  id: string;
  variant_id: string;
  merchant_name: string;
  price: number;
  condition: string;
  url?: string;
}

interface NormalizedPrice {
  price: number;
  confidence: number;
  reason?: string;
}

interface ScrapedListing {
  merchant_name: string;
  price: number;
  condition: string;
  url: string;
  title: string;
}

async function scrapeWithFirecrawl(url: string): Promise<{ markdown: string } | null> {
  const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!firecrawlApiKey) {
    console.error('FIRECRAWL_API_KEY not configured');
    return null;
  }

  try {
    console.log(`Scraping ${url} with Firecrawl...`);
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Firecrawl error for ${url}:`, response.status, errorText);
      return null;
    }

    const data = await response.json();
    return { markdown: data.data?.markdown || '' };
  } catch (error) {
    console.error(`Error scraping ${url} with Firecrawl:`, error);
    return null;
  }
}

async function scrapeFinnNo(productName: string, category: string): Promise<ScrapedListing[]> {
  const searchQuery = encodeURIComponent(productName);
  const finnUrl = `https://www.finn.no/bap/forsale/search.html?q=${searchQuery}`;
  
  console.log(`Scraping Finn.no for: ${productName}`);
  const result = await scrapeWithFirecrawl(finnUrl);
  
  if (!result?.markdown) {
    console.log('No markdown content from Finn.no');
    return [];
  }

  const listings: ScrapedListing[] = [];
  const lines = result.markdown.split('\n');
  
  let currentListing: Partial<ScrapedListing> = {};
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Look for price patterns (e.g., "5 990 kr", "5990 kr", "kr 5990")
    const priceMatch = line.match(/(\d[\d\s]*)\s*kr|kr\s*(\d[\d\s]*)/i);
    if (priceMatch) {
      const priceStr = (priceMatch[1] || priceMatch[2]).replace(/\s/g, '');
      const price = parseInt(priceStr, 10);
      
      if (price > 100 && price < 1000000) {
        currentListing.price = price;
        currentListing.merchant_name = 'Finn.no';
        currentListing.condition = 'used'; // Finn.no is primarily used items
        currentListing.url = finnUrl;
        
        // Look for title in nearby lines
        for (let j = Math.max(0, i - 3); j < Math.min(lines.length, i + 3); j++) {
          const nearbyLine = lines[j].trim();
          if (nearbyLine.length > 10 && nearbyLine.length < 200 && !nearbyLine.match(/kr/i)) {
            currentListing.title = nearbyLine;
            break;
          }
        }
        
        if (currentListing.title) {
          listings.push(currentListing as ScrapedListing);
          currentListing = {};
        }
      }
    }
  }
  
  console.log(`Found ${listings.length} listings on Finn.no`);
  return listings;
}

interface VariantSpec {
  id: string;
  storage_gb: number | null;
  color: string | null;
  model: string | null;
}

interface BatchNormalizationResult {
  matched_listings: {
    variant_id: string;
    listings: {
      finn_listing_index: number;
      confidence: number;
      condition_quality: string;
      price: number;
      url: string;
      title: string;
    }[];
    price_range: { min: number; max: number; median: number };
    quality_tiers: {
      [key: string]: { min: number; max: number; count: number };
    };
  }[];
  unmatched_listings: number[];
  market_insights: {
    summary: string;
    price_trend: string;
    best_value_tier: string;
    recommendation: string;
  };
}

async function batchNormalizeFinnListings(
  productName: string,
  category: string,
  variants: VariantSpec[],
  listings: ScrapedListing[]
): Promise<BatchNormalizationResult | null> {
  const vertexApiKey = Deno.env.get('VERTEX_AI_API_KEY');
  if (!vertexApiKey || listings.length === 0) {
    console.log('No Vertex AI key or no listings');
    return null;
  }

  try {
    const prompt = `You are a product matching AI for a Norwegian price comparison platform.

Product: ${productName}
Category: ${category}

Available Variants:
${JSON.stringify(variants, null, 2)}

Finn.no Listings:
${JSON.stringify(listings.map((l, i) => ({ index: i, title: l.title, price: l.price, url: l.url })), null, 2)}

Tasks:
1. Match each listing to a variant (or mark as unmatched)
2. Assess listing quality based on title
3. Group listings by variant
4. Calculate price ranges and tiers per variant
5. Generate market insights in Norwegian

Quality Assessment Guidelines:
- "excellent": Words like "ny", "ubrukt", "perfekt", "som ny"
- "good": Words like "lite brukt", "god stand", "fungerer perfekt"
- "acceptable": Words like "brukt", "normal slitasje"
- "poor": Words like "defekt", "ødelagt"

Matching Rules:
- Match storage GB (128, 256, 512, 1024)
- Match color (Norwegian and English names)
- Confidence >0.9: Exact match on storage + color
- Confidence 0.7-0.9: Match on storage OR color
- Confidence <0.7: Mark as unmatched

Return the analysis with matched listings grouped by variant, price tiers, and market insights.`;

    console.log(`Batch normalizing ${listings.length} Finn.no listings for ${productName}`);
    
    const response = await fetch(
      'https://europe-west4-aiplatform.googleapis.com/v1/projects/zeivo-477017/locations/europe-west4/publishers/google/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': vertexApiKey
        },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{ text: prompt }]
          }],
          tools: [{
            function_declarations: [{
              name: 'return_normalized_listings',
              description: 'Return normalized and matched listings with price tiers and insights',
              parameters: {
                type: 'object',
                properties: {
                  matched_listings: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        variant_id: { type: 'string' },
                        listings: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              finn_listing_index: { type: 'number' },
                              confidence: { type: 'number' },
                              condition_quality: { type: 'string' },
                              price: { type: 'number' },
                              url: { type: 'string' },
                              title: { type: 'string' }
                            },
                            required: ['finn_listing_index', 'confidence', 'condition_quality', 'price', 'url', 'title']
                          }
                        },
                        price_range: {
                          type: 'object',
                          properties: {
                            min: { type: 'number' },
                            max: { type: 'number' },
                            median: { type: 'number' }
                          }
                        },
                        quality_tiers: {
                          type: 'object',
                          additionalProperties: {
                            type: 'object',
                            properties: {
                              min: { type: 'number' },
                              max: { type: 'number' },
                              count: { type: 'number' }
                            }
                          }
                        }
                      },
                      required: ['variant_id', 'listings', 'price_range', 'quality_tiers']
                    }
                  },
                  unmatched_listings: {
                    type: 'array',
                    items: { type: 'number' }
                  },
                  market_insights: {
                    type: 'object',
                    properties: {
                      summary: { type: 'string' },
                      price_trend: { type: 'string' },
                      best_value_tier: { type: 'string' },
                      recommendation: { type: 'string' }
                    },
                    required: ['summary', 'price_trend', 'best_value_tier', 'recommendation']
                  }
                },
                required: ['matched_listings', 'unmatched_listings', 'market_insights']
              }
            }]
          }],
          tool_config: {
            function_calling_config: {
              mode: 'ANY',
              allowed_function_names: ['return_normalized_listings']
            }
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Vertex AI error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    const functionCall = data.candidates?.[0]?.content?.parts?.[0]?.functionCall;
    
    if (functionCall?.name === 'return_normalized_listings') {
      const result = functionCall.args as BatchNormalizationResult;
      console.log(`✓ Batch normalized ${listings.length} listings into ${result.matched_listings.length} variants`);
      return result;
    }
  } catch (error) {
    console.error('Error in batch normalization:', error);
  }
  
  return null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log('Starting price scraping and normalization...');

    // Fetch all products
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*');

    if (productsError) {
      throw productsError;
    }

    console.log(`Found ${products?.length || 0} products to process`);

    const results = [];
    let totalScraped = 0;

    for (const product of products || []) {
      console.log(`\n=== Processing: ${product.name} ===`);

      // First, scrape Finn.no for fresh listings
      const scrapedListings = await scrapeFinnNo(product.name, product.category);
      totalScraped += scrapedListings.length;

      // Get all variants for this product
      const { data: variants, error: variantsError } = await supabase
        .from('product_variants')
        .select('id, storage_gb, color, model')
        .eq('product_id', product.id);

      if (variantsError || !variants || variants.length === 0) {
        console.log(`No variants found for ${product.name}`);
        continue;
      }

      console.log(`Found ${variants.length} variants`);

      // Batch normalize all scraped listings with AI
      if (scrapedListings.length > 0 && variants.length > 0) {
        const batchResult = await batchNormalizeFinnListings(
          product.name,
          product.category,
          variants.map(v => ({
            id: v.id,
            storage_gb: v.storage_gb,
            color: v.color,
            model: v.model
          })),
          scrapedListings
        );

        if (batchResult) {
          const listingGroupId = crypto.randomUUID();
          
          // Process matched listings by variant
          for (const variantMatch of batchResult.matched_listings) {
            // Clear old Finn.no listings for this variant
            await supabase
              .from('merchant_listings')
              .delete()
              .eq('variant_id', variantMatch.variant_id)
              .eq('merchant_name', 'Finn.no');

            // Insert matched listings with quality tiers
            const listingsToInsert = variantMatch.listings.map(listing => ({
              variant_id: variantMatch.variant_id,
              merchant_name: 'Finn.no',
              price: listing.price,
              condition: 'used',
              url: listing.url,
              is_valid: true,
              confidence: listing.confidence,
              price_tier: listing.condition_quality,
              listing_group_id: listingGroupId,
              market_insight: batchResult.market_insights.recommendation,
            }));

            if (listingsToInsert.length > 0) {
              const { error: insertError } = await supabase
                .from('merchant_listings')
                .insert(listingsToInsert);

              if (insertError) {
                console.error('Error inserting normalized listings:', insertError);
              } else {
                console.log(`✓ Inserted ${listingsToInsert.length} normalized listings for variant ${variantMatch.variant_id}`);
              }
            }

            // Update variant with rich price_data
            const priceData = {
              used: {
                source: 'Finn.no',
                tiers: variantMatch.quality_tiers,
                total_listings: variantMatch.listings.length,
                median_price: variantMatch.price_range.median,
                price_range: variantMatch.price_range,
                recommendation: batchResult.market_insights.recommendation,
                updated_at: new Date().toISOString()
              },
              market_insights: batchResult.market_insights
            };

            const { error: updateError } = await supabase
              .from('product_variants')
              .update({
                price_used: variantMatch.price_range.median,
                confidence: variantMatch.listings.reduce((sum, l) => sum + l.confidence, 0) / variantMatch.listings.length,
                price_data: priceData,
                updated_at: new Date().toISOString(),
              })
              .eq('id', variantMatch.variant_id);

            if (updateError) {
              console.error(`Error updating variant price_data:`, updateError);
            } else {
              console.log(`✓ Updated variant ${variantMatch.variant_id} with rich price data`);
            }
          }

          console.log(`✓ Batch processed ${scrapedListings.length} listings → ${batchResult.matched_listings.length} variants`);
        }
      }

      // Results are now stored in the batch processing above
      // Track summary for response
      for (const variant of variants) {
        const { data: priceData } = await supabase
          .from('product_variants')
          .select('price_used, confidence, price_data')
          .eq('id', variant.id)
          .single();

        if (priceData) {
          results.push({
            product: product.name,
            variant: `${variant.storage_gb}GB ${variant.color}`,
            price_new: null,
            price_used: priceData.price_used,
            confidence: priceData.confidence,
            listings_analyzed: priceData.price_data?.used?.total_listings || 0,
            valid_prices: priceData.price_data?.used?.total_listings || 0,
          });
        }
      }
    }

    console.log('\n=== Price update completed ===');
    console.log(`Scraped ${totalScraped} new listings`);
    console.log(`Processed ${results.length} variants across ${products?.length || 0} products`);

    return new Response(
      JSON.stringify({
        success: true,
        results,
        summary: {
          products_processed: products?.length || 0,
          variants_updated: results.length,
          listings_scraped: totalScraped,
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in update-prices:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
