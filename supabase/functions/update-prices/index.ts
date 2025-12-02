
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
  priority_score?: number;
  last_scraped_at?: string;
  scrape_frequency_hours?: number;
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

async function scrapeWithFirecrawl(supabase: any, url: string): Promise<{ markdown: string } | null> {
  const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!firecrawlApiKey) {
    console.error('FIRECRAWL_API_KEY not configured');
    return null;
  }
  
  const { data, error: budgetError } = await supabase.functions.invoke('budget-manager', {
    body: { action: 'get' },
  });

  if (budgetError || !data?.canScrape) {
    console.log('Scraping budget exhausted, skipping Firecrawl request.');
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
        crawlerOptions: { 
          pageOptions: { onlyMainContent: true }
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Firecrawl error for ${url}:`, response.status, errorText);
      return null;
    }
    
    await supabase.functions.invoke('budget-manager', {
      body: { action: 'increment', increment: 1 },
    });

    const responseData = await response.json();
    return { markdown: responseData.data?.markdown || '' };
  } catch (error) {
    console.error(`Error scraping ${url} with Firecrawl:`, error);
    return null;
  }
}

async function scrapeFinnNo(supabase: any, productName: string, category: string): Promise<ScrapedListing[]> {
  const searchQuery = encodeURIComponent(productName);
  const finnUrl = `https://www.finn.no/bap/forsale/search.html?q=${searchQuery}`;
  
  console.log(`Scraping Finn.no for: ${productName}`);
  const result = await scrapeWithFirecrawl(supabase, finnUrl);
  
  if (!result?.markdown) {
    console.log('No markdown content from Finn.no');
    return [];
  }

  const listings: ScrapedListing[] = [];
  const lines = result.markdown.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    const priceMatch = line.match(/(\d[\d\s]*)\s*kr|kr\s*(\d[\d\s]*)/i);
    if (priceMatch) {
      const priceStr = (priceMatch[1] || priceMatch[2]).replace(/\s/g, '');
      const price = parseInt(priceStr, 10);
      
      if (price > 100 && price < 1000000) {
        let title = '';
        for (let j = Math.max(0, i - 3); j < Math.min(lines.length, i + 3); j++) {
          const nearbyLine = lines[j].trim();
          if (nearbyLine.length > 10 && nearbyLine.length < 200 && !nearbyLine.match(/kr/i)) {
            title = nearbyLine;
            break;
          }
        }
        
        if (title) {
          listings.push({
            merchant_name: 'Finn.no',
            price,
            condition: 'used',
            url: finnUrl, // TODO: try to extract specific listing URL
            title,
          });
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
      listing_index: number;
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

async function batchNormalizeListings(
  productName: string,
  category: string,
  variants: VariantSpec[],
  listings: ScrapedListing[]
): Promise<BatchNormalizationResult | null> {
  const vertexApiKey = Deno.env.get('VERTEX_AI_API_KEY');
  if (!vertexApiKey || listings.length === 0) {
    console.log('No Vertex AI key or no listings to process.');
    return null;
  }

  try {
    const prompt = `You are a product matching AI for a Norwegian price comparison platform.

Product: ${productName}
Category: ${category}

Available Variants:
${JSON.stringify(variants, null, 2)}

Scraped Product Listings:
${JSON.stringify(listings.map((l, i) => ({ index: i, merchant: l.merchant_name, title: l.title, price: l.price, url: l.url })), null, 2)}

Tasks:
1. Match each listing to one of the available variants. If no suitable variant is found, mark the listing as unmatched.
2. For each matched listing, assess its condition and quality based on its title.
3. Group the matched listings by their assigned variant.
4. For each variant, calculate price ranges and create quality tiers.
5. Generate overall market insights in Norwegian.

Condition & Quality Assessment Guidelines:
- Listings from retailers (not Finn.no) should always be considered 'new' and have a quality of 'excellent'.
- For listings from 'Finn.no' (a used marketplace), use the following title keywords:
  - "excellent": "ny", "ubrukt", "perfekt", "som ny", "i eske"
  - "good": "lite brukt", "god stand", "fungerer perfekt"
  - "acceptable": "brukt", "normal slitasje"
  - "poor": "defekt", "ødelagt", "trenger reparasjon"
- If no keywords are present for Finn.no listings, default to "acceptable".

Matching Rules:
- Match on storage size (e.g., 128, 256, 512, 1024 GB).
- Match on color (both Norwegian and English names are possible).
- Confidence >0.9: Requires an exact match on both storage and color.
- Confidence 0.7-0.9: Requires a match on either storage or color.
- Confidence <0.7: The listing should be marked as unmatched.

Return the analysis with matched listings grouped by variant, including price tiers and market insights.`;

    console.log(`Batch normalizing ${listings.length} listings for ${productName}`);
    
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
                              listing_index: { type: 'number' },
                              confidence: { type: 'number' },
                              condition_quality: { type: 'string' },
                              price: { type: 'number' },
                              url: { type: 'string' },
                              title: { type: 'string' }
                            },
                            required: ['listing_index', 'confidence', 'condition_quality', 'price', 'url', 'title']
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

async function scrapeRetailerWithFirecrawl(supabase: any, url: string, retailerName: string): Promise<ScrapedListing[]> {
  const result = await scrapeWithFirecrawl(supabase, url);
  
  if (!result?.markdown) {
    console.log(`No markdown content from ${retailerName}`);
    return [];
  }

  const listings: ScrapedListing[] = [];
  const lines = result.markdown.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    const priceMatch = line.match(/(\d[\d\s]*)\s*kr|kr\s*(\d[\d\s]*)/i);
    if (priceMatch) {
      const priceStr = (priceMatch[1] || priceMatch[2]).replace(/\s/g, '');
      const price = parseInt(priceStr, 10);
      
      if (price > 100 && price < 1000000) {
        let title = '';
        for (let j = Math.max(0, i - 3); j < Math.min(lines.length, i + 3); j++) {
          const nearbyLine = lines[j].trim();
          if (nearbyLine.length > 10 && nearbyLine.length < 200 && !nearbyLine.match(/kr/i)) {
            title = nearbyLine;
            break;
          }
        }
        
        if (title) {
          listings.push({
            merchant_name: retailerName,
            price,
            condition: 'new',
            url,
            title
          });
        }
      }
    }
  }
  
  console.log(`Found ${listings.length} listings on ${retailerName}`);
  return listings;
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

    const { force } = await req.json().catch(() => ({ force: false }));
    
    console.log('Starting intelligent price scraping...', force ? '(FORCED)' : '');

    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .order('priority_score', { ascending: false });

    if (productsError) throw productsError;

    console.log(`Found ${products?.length || 0} products to process`);

    const results = [];
    let totalScraped = 0;

    for (const product of products || []) {
      console.log(`\n=== Processing: ${product.name} (Priority: ${product.priority_score}) ===`);

      if (!force) {
        const hoursSinceLastScrape = product.last_scraped_at 
          ? (Date.now() - new Date(product.last_scraped_at).getTime()) / (1000 * 60 * 60)
          : Infinity;
          
        if (hoursSinceLastScrape < (product.scrape_frequency_hours || 24)) {
          console.log(`Skipping - scraped ${Math.floor(hoursSinceLastScrape)}h ago`);
          continue;
        }
      }

      const scrapedListings = await scrapeFinnNo(supabase, product.name, product.category);
      totalScraped += scrapedListings.length;

      const { data: merchantUrls } = await supabase
        .from('merchant_urls')
        .select('*')
        .eq('category', product.category)
        .eq('is_active', true);

      const retailerListings: ScrapedListing[] = [];
      if (merchantUrls) {
        for (const merchantUrl of merchantUrls) {
          const listings = await scrapeRetailerWithFirecrawl(
            supabase, 
            merchantUrl.url, 
            merchantUrl.merchant_name
          );
          retailerListings.push(...listings);
          
          await supabase
            .from('merchant_urls')
            .update({ last_scraped_at: new Date().toISOString() })
            .eq('id', merchantUrl.id);
        }
      }

      const { data: variants, error: variantsError } = await supabase
        .from('product_variants')
        .select('id, storage_gb, color, model')
        .eq('product_id', product.id);

      if (variantsError || !variants || variants.length === 0) {
        console.log(`No variants found for ${product.name}`);
        continue;
      }

      console.log(`Found ${variants.length} variants`);

      const allListings = [...scrapedListings, ...retailerListings];
      if (allListings.length > 0 && variants.length > 0) {
        const batchResult = await batchNormalizeListings(
          product.name,
          product.category,
          variants.map(v => ({ id: v.id, storage_gb: v.storage_gb, color: v.color, model: v.model })),
          allListings
        );

        if (batchResult) {
          const listingGroupId = crypto.randomUUID();
          
          for (const variantMatch of batchResult.matched_listings) {
            await supabase
              .from('merchant_listings')
              .delete()
              .eq('variant_id', variantMatch.variant_id);

            const listingsToInsert = variantMatch.listings.map(listing => ({
              variant_id: variantMatch.variant_id,
              merchant_name: allListings[listing.listing_index].merchant_name,
              price: listing.price,
              condition: allListings[listing.listing_index].condition,
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
                console.log(`✓ Inserted ${listingsToInsert.length} listings for variant ${variantMatch.variant_id}`);
              }
            }

            const newListings = listingsToInsert.filter(l => l.condition === 'new');
            const usedListings = listingsToInsert.filter(l => l.condition === 'used');
            
            const price_new = newListings.length > 0
              ? Math.round(newListings.reduce((sum, l) => sum + l.price, 0) / newListings.length)
              : null;
              
            const price_used = usedListings.length > 0
              ? variantMatch.price_range.median
              : null;

            const priceData = {
              new: newListings.length > 0 ? {
                source: 'retailers',
                avg_price: price_new,
                total_listings: newListings.length,
                merchants: [...new Set(newListings.map(l => l.merchant_name))],
                updated_at: new Date().toISOString()
              } : null,
              used: usedListings.length > 0 ? {
                source: 'Finn.no',
                tiers: variantMatch.quality_tiers,
                total_listings: usedListings.length,
                median_price: variantMatch.price_range.median,
                price_range: variantMatch.price_range,
                recommendation: batchResult.market_insights.recommendation,
                updated_at: new Date().toISOString()
              } : null,
              market_insights: batchResult.market_insights
            };

            const { error: updateError } = await supabase
              .from('product_variants')
              .update({
                price_new,
                price_used,
                confidence: variantMatch.listings.reduce((sum, l) => sum + l.confidence, 0) / variantMatch.listings.length,
                price_data: priceData,
                updated_at: new Date().toISOString(),
              })
              .eq('id', variantMatch.variant_id);

            if (updateError) {
              console.error(`Error updating variant:`, updateError);
            } else {
              console.log(`✓ Updated variant ${variantMatch.variant_id} with price data`);
            }

            results.push({
              product: product.name,
              variant: `${variantMatch.variant_id}`,
              price_new,
              price_used,
              listings_analyzed: variantMatch.listings.length,
            });
          }

          console.log(`✓ Processed ${allListings.length} listings → ${batchResult.matched_listings.length} variants`);
        }
      }

      await supabase
        .from('products')
        .update({ last_scraped_at: new Date().toISOString() })
        .eq('id', product.id);
    }

    console.log('\n=== Price update completed ===');
    console.log(`Scraped ${totalScraped + retailerListings.length} new listings`);
    console.log(`Processed ${results.length} variants across ${products?.length || 0} products`);

    return new Response(
      JSON.stringify({
        success: true,
        results,
        summary: {
          products_processed: products?.length || 0,
          variants_updated: results.length,
          listings_scraped: totalScraped + retailerListings.length,
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

