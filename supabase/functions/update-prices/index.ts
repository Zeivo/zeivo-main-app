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

async function normalizePricesWithVertexAI(
  productName: string,
  category: string,
  listings: MerchantListing[]
): Promise<NormalizedPrice[]> {
  const vertexApiKey = Deno.env.get('VERTEX_AI_API_KEY');
  if (!vertexApiKey || listings.length === 0) {
    console.log('No Vertex AI key or no listings, returning raw prices');
    return listings.map(l => ({ price: l.price, confidence: 0.5 }));
  }

  try {
    const listingsSummary = listings.map((l, i) => 
      `${i + 1}. ${l.merchant_name}: ${l.price} kr (condition: ${l.condition})`
    ).join('\n');

    const prompt = `You are analyzing price data for: "${productName}" (Category: ${category})

Here are the scraped listings:
${listingsSummary}

Task: Identify which prices are valid for the actual product (not accessories, cases, or wrong products). 
- Filter out obvious outliers and mismatches
- Consider that used items should be cheaper than new
- Return ONLY valid prices with confidence scores

Return JSON array format:
[
  {"price": 5990, "confidence": 0.9, "reason": "Valid new price from retailer"},
  {"price": 4500, "confidence": 0.8, "reason": "Valid used price"}
]`;

    console.log(`Calling Vertex AI for ${productName} with ${listings.length} listings`);
    
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
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json'
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Vertex AI error:', response.status, errorText);
      return listings.map(l => ({ price: l.price, confidence: 0.5 }));
    }

    const data = await response.json();
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (aiResponse) {
      const normalized = JSON.parse(aiResponse);
      console.log(`✓ Vertex AI normalized ${normalized.length}/${listings.length} prices for ${productName}`);
      return normalized;
    }
  } catch (error) {
    console.error('Error normalizing with Vertex AI:', error);
  }
  
  return listings.map(l => ({ price: l.price, confidence: 0.5 }));
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

      // Store scraped listings (use first variant for simplicity, or implement better matching)
      if (scrapedListings.length > 0 && variants.length > 0) {
        const variantId = variants[0].id;
        
        // Clear old Finn.no listings for this variant
        await supabase
          .from('merchant_listings')
          .delete()
          .eq('variant_id', variantId)
          .eq('merchant_name', 'Finn.no');

        // Insert new scraped listings
        const listingsToInsert = scrapedListings.map(listing => ({
          variant_id: variantId,
          merchant_name: listing.merchant_name,
          price: listing.price,
          condition: listing.condition,
          url: listing.url,
          is_valid: true,
        }));

        if (listingsToInsert.length > 0) {
          const { error: insertError } = await supabase
            .from('merchant_listings')
            .insert(listingsToInsert);

          if (insertError) {
            console.error('Error inserting scraped listings:', insertError);
          } else {
            console.log(`✓ Inserted ${listingsToInsert.length} new listings from Finn.no`);
          }
        }
      }

      // Process each variant
      for (const variant of variants) {
        console.log(`\nProcessing variant: ${variant.storage_gb || 'unknown'} GB, ${variant.color || 'unknown'}`);

        // Get all merchant listings for this variant (including newly scraped ones)
        const { data: listings, error: listingsError } = await supabase
          .from('merchant_listings')
          .select('id, variant_id, merchant_name, price, condition, url')
          .eq('variant_id', variant.id)
          .eq('is_valid', true);

        if (listingsError || !listings || listings.length === 0) {
          console.log(`No listings found for variant ${variant.id}`);
          continue;
        }

        console.log(`Found ${listings.length} listings for this variant`);

        // Normalize prices with Vertex AI
        const normalizedPrices = await normalizePricesWithVertexAI(
          product.name,
          product.category,
          listings
        );

        if (normalizedPrices.length === 0) {
          console.log('No valid prices after normalization');
          continue;
        }

        // Separate by condition
        const newPrices = normalizedPrices.filter((_, i) => 
          listings[i].condition === 'new'
        );
        const usedPrices = normalizedPrices.filter((_, i) => 
          listings[i].condition === 'used'
        );

        // Calculate averages
        let avgNewPrice = null;
        let avgUsedPrice = null;

        if (newPrices.length > 0) {
          avgNewPrice = Math.round(
            newPrices.reduce((sum, p) => sum + p.price, 0) / newPrices.length
          );
          console.log(`✓ Calculated avg new price: ${avgNewPrice} kr (from ${newPrices.length} listings)`);
        }

        if (usedPrices.length > 0) {
          avgUsedPrice = Math.round(
            usedPrices.reduce((sum, p) => sum + p.price, 0) / usedPrices.length
          );
          console.log(`✓ Calculated avg used price: ${avgUsedPrice} kr (from ${usedPrices.length} listings)`);
        }

        // Calculate overall confidence
        const avgConfidence = normalizedPrices.reduce((sum, p) => sum + p.confidence, 0) / normalizedPrices.length;

        // Update variant with normalized prices
        const { error: updateError } = await supabase
          .from('product_variants')
          .update({
            price_new: avgNewPrice,
            price_used: avgUsedPrice,
            confidence: avgConfidence,
            updated_at: new Date().toISOString(),
          })
          .eq('id', variant.id);

        if (updateError) {
          console.error(`Error updating variant ${variant.id}:`, updateError);
        } else {
          console.log(`✓ Updated variant ${variant.id} with AI-normalized prices`);
          results.push({
            product: product.name,
            variant: `${variant.storage_gb}GB ${variant.color}`,
            price_new: avgNewPrice,
            price_used: avgUsedPrice,
            confidence: avgConfidence,
            listings_analyzed: listings.length,
            valid_prices: normalizedPrices.length,
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
