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

interface FirecrawlResult {
  markdown?: string;
  html?: string;
  links?: string[];
  rawHtml?: string;
  metadata?: any;
}

/**
 * Scrapes a URL using Firecrawl v2 API with enhanced options
 *
 * Improvements over v1:
 * - Multiple format support (markdown, html, links)
 * - waitFor option for dynamic content loading
 * - Configurable timeout for slow pages
 * - Extracts individual links for better data quality
 *
 * @param supabase - Supabase client instance
 * @param url - URL to scrape
 * @param options - Scraping options (formats, waitFor, timeout)
 * @returns FirecrawlResult with multiple formats or null on error
 */
async function scrapeWithFirecrawl(
  supabase: any,
  url: string,
  options: {
    formats?: string[];
    waitFor?: number;
    timeout?: number;
  } = {}
): Promise<FirecrawlResult | null> {
  const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!firecrawlApiKey) {
    console.error('FIRECRAWL_API_KEY not configured');
    return null;
  }

  // Check budget before scraping
  const { data: canScrape, error: budgetError } = await supabase.functions.invoke('budget-manager', {
    body: {},
  });

  if (budgetError || !canScrape?.canScrape) {
    console.log('Scraping budget exhausted, skipping Firecrawl request.');
    return null;
  }

  try {
    console.log(`Scraping ${url} with Firecrawl v2...`);

    // Default options: multiple formats, wait for dynamic content, reasonable timeout
    const scrapeOptions = {
      url,
      formats: options.formats || ['markdown', 'html', 'links'],
      timeout: options.timeout || 15000,  // 15 seconds
      waitFor: options.waitFor || 2000,   // 2 seconds for JS content to load
    };

    const response = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(scrapeOptions),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Firecrawl error for ${url}:`, response.status, errorText);
      return null;
    }

    // Increment budget after successful scrape
    await supabase.functions.invoke('budget-manager', {
      body: { increment: 1 },
    });

    const data = await response.json();
    const result: FirecrawlResult = {
      markdown: data.data?.markdown || '',
      html: data.data?.html || '',
      links: data.data?.links || [],
      rawHtml: data.data?.rawHtml || '',
      metadata: data.data?.metadata || {},
    };

    console.log(`✓ Scraped ${url} - Extracted ${result.links?.length || 0} links`);
    return result;
  } catch (error) {
    console.error(`Error scraping ${url} with Firecrawl:`, error);
    return null;
  }
}

async function scrapeFinnNo(supabase: any, productName: string, category: string): Promise<ScrapedListing[]> {
  const searchQuery = encodeURIComponent(productName);
  const finnUrl = `https://www.finn.no/bap/forsale/search.html?q=${searchQuery}`;

  console.log(`Scraping Finn.no for: ${productName}`);
  const result = await scrapeWithFirecrawl(supabase, finnUrl, {
    waitFor: 3000,  // Finn.no needs time to load dynamic content
  });

  if (!result?.markdown) {
    console.log('No markdown content from Finn.no');
    return [];
  }

  const listings: ScrapedListing[] = [];
  const lines = result.markdown.split('\n');

  // Extract individual listing URLs from the links array
  const listingUrls = (result.links || []).filter(link =>
    link.includes('finn.no') &&
    (link.includes('/bap/') || link.includes('/forsale/')) &&
    !link.includes('/search.html') &&
    link.match(/\/\d+$/)  // Finn.no listing URLs typically end with a numeric ID
  );

  console.log(`Found ${listingUrls.length} individual listing URLs`);

  // Create a map of listing URLs for quick lookup
  const urlMap = new Map<number, string>();
  let urlIndex = 0;

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

        // Assign individual listing URL if available, otherwise use search URL
        currentListing.url = listingUrls[urlIndex] || finnUrl;
        if (listingUrls[urlIndex]) {
          urlIndex++;
        }

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

  console.log(`✓ Found ${listings.length} listings with ${listings.filter(l => l.url !== finnUrl).length} individual URLs`);
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

async function scrapeRetailerWithFirecrawl(supabase: any, url: string, retailerName: string): Promise<ScrapedListing[]> {
  const result = await scrapeWithFirecrawl(supabase, url, {
    waitFor: 2000,  // Wait for dynamic pricing to load
  });

  if (!result?.markdown) {
    console.log(`No markdown content from ${retailerName}`);
    return [];
  }

  const listings: ScrapedListing[] = [];
  const lines = result.markdown.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Look for Norwegian price patterns (e.g., "5 990 kr", "kr 5990")
    const priceMatch = line.match(/(\d[\d\s]*)\s*kr|kr\s*(\d[\d\s]*)/i);
    if (priceMatch) {
      const priceStr = (priceMatch[1] || priceMatch[2]).replace(/\s/g, '');
      const price = parseInt(priceStr, 10);

      if (price > 100 && price < 1000000) {
        let title = '';
        // Look for title in nearby lines
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

interface BatchScrapeJob {
  id: string;
  url: string;
  merchant_name: string;
}

/**
 * Batch scrapes multiple retailer URLs concurrently using Firecrawl v2 Batch API
 *
 * Key benefits:
 * - Scrapes multiple URLs in parallel (vs sequential scraping)
 * - More efficient use of API quota
 * - Automatic budget management (respects daily limits)
 * - Returns both listings and scraped IDs for database updates
 *
 * Process:
 * 1. Checks budget and calculates how many URLs can be scraped
 * 2. Initiates batch scrape job via Firecrawl API
 * 3. Polls for job completion (max 5 minutes)
 * 4. Processes results and extracts price/title from markdown
 * 5. Updates budget and returns listings
 *
 * @param supabase - Supabase client instance
 * @param merchantUrls - Array of merchant URL objects to scrape
 * @returns Object with extracted listings and successfully scraped IDs
 */
async function batchScrapeRetailers(
  supabase: any,
  merchantUrls: Array<{ id: string; url: string; merchant_name: string }>
): Promise<{ listings: ScrapedListing[]; scrapedIds: string[] }> {
  const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!firecrawlApiKey || !merchantUrls || merchantUrls.length === 0) {
    console.log('No Firecrawl API key or no merchant URLs provided');
    return { listings: [], scrapedIds: [] };
  }

  // Check budget before batch scraping
  const { data: budgetCheck } = await supabase.functions.invoke('budget-manager', {
    body: {},
  });

  if (!budgetCheck?.canScrape) {
    console.log('Scraping budget exhausted, skipping batch scrape.');
    return { listings: [], scrapedIds: [] };
  }

  // Calculate how many URLs we can scrape based on remaining budget
  const remainingBudget = budgetCheck.budget?.daily_limit - budgetCheck.budget?.requests_used || 0;
  const urlsToScrape = merchantUrls.slice(0, Math.min(merchantUrls.length, remainingBudget));

  console.log(`Batch scraping ${urlsToScrape.length} retailer URLs...`);

  try {
    // Initiate batch scrape job
    const response = await fetch('https://api.firecrawl.dev/v2/batch/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        urls: urlsToScrape.map(m => m.url),
        formats: ['markdown', 'html'],
        timeout: 15000,
        waitFor: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Batch scrape error:', response.status, errorText);
      return { listings: [], scrapedIds: [] };
    }

    const data = await response.json();
    const jobId = data.id;

    console.log(`Batch scrape job started: ${jobId}`);

    // Poll for job completion (with timeout)
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max (5 seconds * 60)
    let jobComplete = false;
    let results: any[] = [];

    while (attempts < maxAttempts && !jobComplete) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

      const statusResponse = await fetch(`https://api.firecrawl.dev/v2/batch/scrape/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${firecrawlApiKey}`,
        },
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        console.log(`Batch job status: ${statusData.status} (${statusData.completed}/${statusData.total})`);

        if (statusData.status === 'completed') {
          results = statusData.data || [];
          jobComplete = true;
        } else if (statusData.status === 'failed') {
          console.error('Batch scrape job failed');
          break;
        }
      }

      attempts++;
    }

    if (!jobComplete) {
      console.log('Batch scrape job timed out, processing partial results...');
    }

    // Increment budget for successful scrapes
    await supabase.functions.invoke('budget-manager', {
      body: { increment: urlsToScrape.length },
    });

    // Process results and extract listings
    const allListings: ScrapedListing[] = [];
    const scrapedIds: string[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const merchantUrl = urlsToScrape[i];

      if (!result?.markdown) {
        console.log(`No content for ${merchantUrl.merchant_name}`);
        continue;
      }

      scrapedIds.push(merchantUrl.id);

      // Parse markdown for price and title
      const lines = result.markdown.split('\n');

      for (let j = 0; j < lines.length; j++) {
        const line = lines[j].trim();

        const priceMatch = line.match(/(\d[\d\s]*)\s*kr|kr\s*(\d[\d\s]*)/i);
        if (priceMatch) {
          const priceStr = (priceMatch[1] || priceMatch[2]).replace(/\s/g, '');
          const price = parseInt(priceStr, 10);

          if (price > 100 && price < 1000000) {
            let title = '';
            for (let k = Math.max(0, j - 3); k < Math.min(lines.length, j + 3); k++) {
              const nearbyLine = lines[k].trim();
              if (nearbyLine.length > 10 && nearbyLine.length < 200 && !nearbyLine.match(/kr/i)) {
                title = nearbyLine;
                break;
              }
            }

            if (title) {
              allListings.push({
                merchant_name: merchantUrl.merchant_name,
                price,
                condition: 'new',
                url: merchantUrl.url,
                title
              });
            }
          }
        }
      }
    }

    console.log(`✓ Batch scraped ${urlsToScrape.length} URLs, extracted ${allListings.length} listings`);
    return { listings: allListings, scrapedIds };

  } catch (error) {
    console.error('Error in batch scraping:', error);
    return { listings: [], scrapedIds: [] };
  }
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

    // Check if force scraping is enabled
    const { force } = await req.json().catch(() => ({ force: false }));
    
    console.log('Starting intelligent price scraping...', force ? '(FORCED)' : '');

    // Fetch products ordered by priority
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .order('priority_score', { ascending: false });

    if (productsError) {
      throw productsError;
    }

    console.log(`Found ${products?.length || 0} products to process`);

    const results = [];
    let totalScraped = 0;
    const maxRequests = 50; // Cap per run

    for (const product of products || []) {
      console.log(`\n=== Processing: ${product.name} (Priority: ${product.priority_score}) ===`);

      // Check if product needs scraping based on frequency (unless forced)
      if (!force) {
        const hoursSinceLastScrape = product.last_scraped_at 
          ? (Date.now() - new Date(product.last_scraped_at).getTime()) / (1000 * 60 * 60)
          : Infinity;
          
        if (hoursSinceLastScrape < (product.scrape_frequency_hours || 24)) {
          console.log(`Skipping - scraped ${Math.floor(hoursSinceLastScrape)}h ago`);
          continue;
        }
      }

      // Scrape Finn.no for used listings
      const scrapedListings = await scrapeFinnNo(supabase, product.name, product.category);
      totalScraped += scrapedListings.length;

      // Get merchant URLs for this product category
      const { data: merchantUrls } = await supabase
        .from('merchant_urls')
        .select('*')
        .eq('category', product.category)
        .eq('is_active', true);

      // Scrape retailers for new products using batch scraping
      let retailerListings: ScrapedListing[] = [];
      if (merchantUrls && merchantUrls.length > 0) {
        // Use batch scraping for efficiency (v2 API)
        const { listings, scrapedIds } = await batchScrapeRetailers(supabase, merchantUrls);
        retailerListings = listings;

        // Update last_scraped_at for successfully scraped URLs
        if (scrapedIds.length > 0) {
          await supabase
            .from('merchant_urls')
            .update({ last_scraped_at: new Date().toISOString() })
            .in('id', scrapedIds);
        }
      }

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

      // Batch normalize with AI
      const allListings = [...scrapedListings, ...retailerListings];
      if (allListings.length > 0 && variants.length > 0) {
        const batchResult = await batchNormalizeFinnListings(
          product.name,
          product.category,
          variants.map(v => ({
            id: v.id,
            storage_gb: v.storage_gb,
            color: v.color,
            model: v.model
          })),
          allListings
        );

        if (batchResult) {
          const listingGroupId = crypto.randomUUID();
          
          for (const variantMatch of batchResult.matched_listings) {
            // Clear old listings for this variant
            await supabase
              .from('merchant_listings')
              .delete()
              .eq('variant_id', variantMatch.variant_id);

            // Insert matched listings with quality tiers
            const listingsToInsert = variantMatch.listings.map(listing => ({
              variant_id: variantMatch.variant_id,
              merchant_name: allListings[listing.finn_listing_index].merchant_name,
              price: listing.price,
              condition: allListings[listing.finn_listing_index].condition,
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

            // Calculate prices by condition
            const newListings = listingsToInsert.filter(l => l.condition === 'new');
            const usedListings = listingsToInsert.filter(l => l.condition === 'used');
            
            const price_new = newListings.length > 0
              ? Math.round(newListings.reduce((sum, l) => sum + l.price, 0) / newListings.length)
              : null;
              
            const price_used = usedListings.length > 0
              ? variantMatch.price_range.median
              : null;

            // Update variant with rich price_data
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
              confidence: priceData.used?.total_listings || priceData.new?.total_listings || 0,
              listings_analyzed: variantMatch.listings.length,
            });
          }

          console.log(`✓ Processed ${allListings.length} listings → ${batchResult.matched_listings.length} variants`);
        }
      }

      // Update product last_scraped_at
      await supabase
        .from('products')
        .update({ last_scraped_at: new Date().toISOString() })
        .eq('id', product.id);
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
