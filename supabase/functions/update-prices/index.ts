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
}

interface ScrapedListing {
  merchant_name: string;
  url: string;
  price: number;
  variant_info: {
    storage_gb?: number;
    color?: string;
    model?: string;
  };
  condition: 'new' | 'used';
  confidence: number;
}

// Norwegian retailers to scrape
const STORE_SEARCH_URLS: Record<string, (productName: string) => string> = {
  'Komplett': (name) => `https://www.komplett.no/search?q=${encodeURIComponent(name)}`,
  'Elkjøp': (name) => `https://www.elkjop.no/search?SearchTerm=${encodeURIComponent(name)}`,
  'Power': (name) => `https://www.power.no/search/?q=${encodeURIComponent(name)}`,
  'NetOnNet': (name) => `https://www.netonnet.no/search?q=${encodeURIComponent(name)}`,
};

async function scrapeWithFirecrawl(url: string): Promise<any> {
  const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!firecrawlApiKey) {
    console.error('FIRECRAWL_API_KEY not configured');
    return null;
  }

  try {
    console.log(`Scraping URL: ${url}`);
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown', 'html'],
        onlyMainContent: true,
      }),
    });

    if (!response.ok) {
      console.error(`Firecrawl error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Firecrawl scraping error:', error);
    return null;
  }
}

function extractVariantFromText(text: string, productName: string): {
  storage_gb?: number;
  color?: string;
  price?: number;
} {
  const result: any = {};

  // Extract storage (e.g., "128GB", "256 GB", "1TB")
  const storageMatch = text.match(/(\d+)\s*(GB|TB)/i);
  if (storageMatch) {
    let storage = parseInt(storageMatch[1]);
    if (storageMatch[2].toUpperCase() === 'TB') {
      storage *= 1024;
    }
    result.storage_gb = storage;
  }

  // Extract color (common Norwegian color names)
  const colors = [
    'svart', 'black', 'obsidian', 'midnight',
    'hvit', 'white', 'snow',
    'blå', 'blue', 'bay',
    'grønn', 'green', 
    'rosa', 'pink', 'rose',
    'lilla', 'purple', 'violet',
    'gull', 'gold',
    'sølv', 'silver',
    'titan', 'titanium',
    'natural',
  ];
  
  const colorMatch = colors.find(color => 
    text.toLowerCase().includes(color.toLowerCase())
  );
  if (colorMatch) {
    result.color = colorMatch.charAt(0).toUpperCase() + colorMatch.slice(1);
  }

  // Extract price (Norwegian format: "kr 11.990", "11990,-", "11 990 kr")
  const pricePatterns = [
    /(\d{1,3}(?:[\s.]?\d{3})+)\s*kr/i,
    /kr\s*(\d{1,3}(?:[\s.]?\d{3})+)/i,
    /(\d{1,3}(?:[\s.]?\d{3})+),-/,
  ];

  for (const pattern of pricePatterns) {
    const match = text.match(pattern);
    if (match) {
      const priceStr = match[1].replace(/[^\d]/g, '');
      const price = parseInt(priceStr);
      if (price > 100 && price < 1000000) { // Sanity check
        result.price = price;
        break;
      }
    }
  }

  return result;
}

async function scrapeProductListings(
  productName: string,
  merchantName: string,
  searchUrl: string
): Promise<ScrapedListing[]> {
  console.log(`Scraping ${merchantName} for ${productName}`);
  
  const scrapedData = await scrapeWithFirecrawl(searchUrl);
  if (!scrapedData || !scrapedData.data) {
    console.log(`No data from ${merchantName}`);
    return [];
  }

  const listings: ScrapedListing[] = [];
  const content = scrapedData.data.markdown || scrapedData.data.html || '';

  // Split content into potential product blocks
  const blocks = content.split(/\n\n+/);
  
  for (const block of blocks) {
    // Check if this block mentions the product
    const productWords = productName.toLowerCase().split(' ');
    const blockLower = block.toLowerCase();
    const matchCount = productWords.filter(word => blockLower.includes(word)).length;
    
    if (matchCount < 2) {
      continue; // Need at least 2 words matching
    }

    const variantInfo = extractVariantFromText(block, productName);
    
    if (variantInfo.price) {
      listings.push({
        merchant_name: merchantName,
        url: searchUrl,
        price: variantInfo.price,
        variant_info: {
          storage_gb: variantInfo.storage_gb,
          color: variantInfo.color,
        },
        condition: 'new',
        confidence: 0.7, // Rule-based extraction has medium confidence
      });
    }
  }

  console.log(`Found ${listings.length} listings from ${merchantName}`);
  return listings;
}

async function validatePricesWithVertexAI(
  productName: string,
  prices: number[],
  condition: string
): Promise<number[]> {
  const vertexApiKey = Deno.env.get('VERTEX_AI_API_KEY');
  if (!vertexApiKey || prices.length === 0) {
    return prices;
  }

  try {
    const prompt = `Given the product "${productName}" with condition "${condition}", determine which of these prices are realistic and likely from the correct product (not accessories or different models): ${prices.join(', ')} kr. Return only the valid prices as a JSON array of numbers.`;
    
    const response = await fetch(
      'https://europe-west4-aiplatform.googleapis.com/v1/projects/zeivo-477017/locations/europe-west4/publishers/google/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${vertexApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024,
          }
        })
      }
    );

    if (!response.ok) {
      console.error('Vertex AI validation failed:', response.status);
      return prices;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = text.match(/\[[\d,\s]+\]/);
    
    if (jsonMatch) {
      const validPrices = JSON.parse(jsonMatch[0]);
      console.log(`Validated ${validPrices.length}/${prices.length} prices for ${productName}`);
      return validPrices;
    }
  } catch (error) {
    console.error('Error validating prices with Vertex AI:', error);
  }
  
  return prices;
}

async function scrapeFinnNo(
  productName: string,
  condition: 1 | 2 | 3,
  brand?: string
): Promise<number | null> {
  // condition 1 = "helt ny" (brand new)
  // condition 2 = "som ny" (like new)  
  // condition 3 = "pent brukt" (well used)
  
  const conditionNames = { 1: 'helt ny', 2: 'som ny', 3: 'pent brukt' };
  let searchUrl = `https://www.finn.no/recommerce/forsale/search?q=${encodeURIComponent(productName)}&condition=${condition}&shipping_types=0&sort=PRICE_DESC`;
  
  if (brand) {
    searchUrl += `&brand=${brand}`;
  }
  
  console.log(`Scraping Finn.no for ${conditionNames[condition]}: ${productName}`);
  const scrapedData = await scrapeWithFirecrawl(searchUrl);
  
  if (!scrapedData || !scrapedData.data) {
    return null;
  }

  const content = scrapedData.data.markdown || '';
  const prices: number[] = [];
  
  // Extract prices from Finn.no
  const priceMatches = content.matchAll(/(\d{1,3}(?:[\s.]?\d{3})+)\s*kr/gi);
  for (const match of priceMatches) {
    const priceStr = match[1].replace(/[^\d]/g, '');
    const price = parseInt(priceStr);
    
    if (price > 1000 && price < 100000) {
      prices.push(price);
    }
  }

  if (prices.length === 0) {
    return null;
  }

  // Take top 3 prices for validation
  const topPrices = prices.slice(0, 3);

  // Validate prices with Vertex AI
  const validPrices = await validatePricesWithVertexAI(productName, topPrices, conditionNames[condition]);
  
  if (validPrices.length === 0) {
    return null;
  }

  // Calculate average of valid prices
  const average = Math.round(validPrices.reduce((a, b) => a + b, 0) / validPrices.length);
  console.log(`Found ${validPrices.length} valid prices for ${conditionNames[condition]}, average: ${average} kr`);
  
  return average;
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

    console.log('Starting price update job...');

    // Fetch all products
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*');

    if (productsError) {
      throw productsError;
    }

    console.log(`Found ${products?.length || 0} products to update`);

    const results = [];

    for (const product of products || []) {
      console.log(`\n=== Processing: ${product.name} ===`);

      // Scrape new listings from retailers
      const allNewListings: ScrapedListing[] = [];
      
      for (const [merchantName, urlGenerator] of Object.entries(STORE_SEARCH_URLS)) {
        const searchUrl = urlGenerator(product.name);
        const listings = await scrapeProductListings(product.name, merchantName, searchUrl);
        allNewListings.push(...listings);
        
        // Rate limiting - be nice to the scraped sites
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      console.log(`Total listings found: ${allNewListings.length}`);

      // Group listings by variant (storage + color)
      const variantGroups = new Map<string, ScrapedListing[]>();
      
      for (const listing of allNewListings) {
        const key = `${listing.variant_info.storage_gb || 'unknown'}-${listing.variant_info.color || 'unknown'}`;
        if (!variantGroups.has(key)) {
          variantGroups.set(key, []);
        }
        variantGroups.get(key)!.push(listing);
      }

      console.log(`Grouped into ${variantGroups.size} variants`);

      // Create or update variants
      for (const [variantKey, listings] of variantGroups.entries()) {
        const firstListing = listings[0];
        const prices = listings.map(l => l.price);
        const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
        
        console.log(`Processing variant: ${variantKey}, ${listings.length} listings, avg price: ${avgPrice}`);

        // Check if variant exists
        const { data: existingVariant } = await supabase
          .from('product_variants')
          .select('id')
          .eq('product_id', product.id)
          .eq('storage_gb', firstListing.variant_info.storage_gb || null)
          .eq('color', firstListing.variant_info.color || null)
          .maybeSingle();

        let variantId: string;

        if (existingVariant) {
          // Update existing variant
          const { data: updated } = await supabase
            .from('product_variants')
            .update({ 
              price_new: avgPrice,
              confidence: 0.8,
            })
            .eq('id', existingVariant.id)
            .select('id')
            .single();
          
          variantId = updated!.id;
          console.log(`Updated variant ${variantId} with ${listings.length} listings`);
        } else {
          // Create new variant
          const { data: created } = await supabase
            .from('product_variants')
            .insert({
              product_id: product.id,
              storage_gb: firstListing.variant_info.storage_gb,
              color: firstListing.variant_info.color,
              price_new: avgPrice,
              confidence: 0.8,
            })
            .select('id')
            .single();
          
          variantId = created!.id;
          console.log(`Created new variant ${variantId} with ${listings.length} listings`);
        }

        // Delete old merchant listings for this variant
        await supabase
          .from('merchant_listings')
          .delete()
          .eq('variant_id', variantId)
          .eq('condition', 'new');

        // Insert ALL merchant listings (not just one per merchant)
        const listingsToInsert = listings.map(listing => ({
          variant_id: variantId,
          merchant_name: listing.merchant_name,
          url: listing.url,
          price: listing.price,
          condition: listing.condition,
          confidence: listing.confidence,
        }));

        if (listingsToInsert.length > 0) {
          const { error: insertError } = await supabase
            .from('merchant_listings')
            .insert(listingsToInsert);
          
          if (insertError) {
            console.error(`Error inserting listings:`, insertError);
          } else {
            console.log(`✓ Inserted ${listingsToInsert.length} merchant listings for variant ${variantId}`);
          }
        }

        // Create AI job for extracting product image if variant doesn't have one
        if (!existingVariant || !existingVariant.image_url) {
          await supabase
            .from('ai_jobs')
            .insert({
              kind: 'extract_product_image',
              payload: {
                variant_id: variantId,
                product_name: product.name,
                product_image: product.image,
                variant_info: firstListing.variant_info,
              },
              status: 'pending',
            });
        }
      }

      // Scrape used prices from Finn.no for 3 conditions
      const conditions = [
        { id: 1 as const, name: 'Helt ny', dbCondition: 'new' },
        { id: 2 as const, name: 'Som ny', dbCondition: 'used' },
        { id: 3 as const, name: 'Pent brukt', dbCondition: 'used' }
      ];
      
      const finnPrices: Array<{ condition: string; price: number; dbCondition: string }> = [];
      
      for (const cond of conditions) {
        const avgPrice = await scrapeFinnNo(product.name, cond.id, product.brand);
        if (avgPrice) {
          finnPrices.push({ 
            condition: cond.name, 
            price: avgPrice,
            dbCondition: cond.dbCondition
          });
        }
        await new Promise(resolve => setTimeout(resolve, 2000)); // Rate limiting
      }
      
      if (finnPrices.length > 0) {
        console.log(`Finn.no found ${finnPrices.length} condition averages`);
        
        // Get all variants for this product
        const { data: allVariants } = await supabase
          .from('product_variants')
          .select('id')
          .eq('product_id', product.id);
        
        if (allVariants && allVariants.length > 0) {
          // Create finn.no listings for each variant
          for (const variant of allVariants) {
            // Delete old finn.no listings for this variant
            await supabase
              .from('merchant_listings')
              .delete()
              .eq('variant_id', variant.id)
              .like('merchant_name', 'Finn.no%');
            
            // Insert one listing per condition
            const finnListingsToInsert = finnPrices.map(fp => ({
              variant_id: variant.id,
              merchant_name: `Finn.no (${fp.condition})`,
              url: `https://www.finn.no/recommerce/forsale/search?q=${encodeURIComponent(product.name)}&shipping_types=0`,
              price: fp.price,
              condition: fp.dbCondition as 'new' | 'used',
              confidence: 0.8,
            }));
            
            if (finnListingsToInsert.length > 0) {
              const { error: insertError } = await supabase
                .from('merchant_listings')
                .insert(finnListingsToInsert);
              
              if (insertError) {
                console.error(`Error inserting Finn.no listings:`, insertError);
              } else {
                console.log(`✓ Inserted ${finnListingsToInsert.length} Finn.no condition averages for variant ${variant.id}`);
              }
            }
          }
        }
      }

      results.push({
        product: product.name,
        variants: variantGroups.size,
        new_listings: allNewListings.length,
        finn_conditions: finnPrices.length,
      });

      // Rate limiting between products
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log('\n=== Price update completed ===');

    return new Response(
      JSON.stringify({ 
        success: true,
        results,
        message: 'Price update completed',
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Error in update-prices:', error);
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
