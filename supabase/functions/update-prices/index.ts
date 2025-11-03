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
}

interface ScrapedPrice {
  merchant_name: string;
  price: number;
  url: string;
  condition: string;
}

// Store URLs to scrape - in production, these would be in the database
const STORE_SEARCH_URLS: Record<string, (productName: string) => string> = {
  'Elkjøp': (name) => `https://www.elkjop.no/search?SearchTerm=${encodeURIComponent(name)}`,
  'Komplett': (name) => `https://www.komplett.no/search?q=${encodeURIComponent(name)}`,
  'Power': (name) => `https://www.power.no/search/?q=${encodeURIComponent(name)}`,
  'NetOnNet': (name) => `https://www.netonnet.no/search?q=${encodeURIComponent(name)}`,
};

async function scrapePrice(url: string, merchantName: string, productName: string): Promise<ScrapedPrice | null> {
  const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");
  
  try {
    console.log(`Scraping ${merchantName} for ${productName}...`);
    
    // Use Firecrawl to scrape the page
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${firecrawlApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: url,
        formats: ["markdown"],
      }),
    });

    if (!response.ok) {
      console.error(`Firecrawl error for ${merchantName}:`, await response.text());
      return null;
    }

    const data = await response.json();
    const markdown = data.data?.markdown || "";
    
    // Extract price from markdown using regex patterns
    // Norwegian stores typically show prices like "13 990 kr" or "13.990,-"
    const pricePatterns = [
      /(\d{1,3}[\s.]?\d{3}[\s.]?\d{3})\s*kr/i,  // 13 990 kr or 13.990 kr
      /(\d{1,3}[\s.]?\d{3})\s*kr/i,             // 990 kr or 13 990 kr
      /kr\s*(\d{1,3}[\s.]?\d{3}[\s.]?\d{3})/i,  // kr 13 990
      /(\d{1,3}[\s.]?\d{3}[\s.]?\d{3}),-/i,     // 13.990,-
    ];

    let extractedPrice: number | null = null;

    for (const pattern of pricePatterns) {
      const match = markdown.match(pattern);
      if (match) {
        // Remove spaces and dots, convert to number
        const priceStr = match[1].replace(/[\s.]/g, "");
        extractedPrice = parseInt(priceStr, 10);
        if (extractedPrice > 0) {
          break;
        }
      }
    }

    if (!extractedPrice) {
      console.log(`No price found for ${merchantName}`);
      return null;
    }

    console.log(`Found price at ${merchantName}: ${extractedPrice} kr`);

    return {
      merchant_name: merchantName,
      price: extractedPrice,
      url: url,
      condition: "new",
    };
  } catch (error) {
    console.error(`Error scraping ${merchantName}:`, error);
    return null;
  }
}

async function scrapeFinnNo(productName: string): Promise<{ low: number; high: number } | null> {
  const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");
  const searchUrl = `https://www.finn.no/bap/forsale/search.html?q=${encodeURIComponent(productName)}`;

  try {
    console.log(`Scraping Finn.no for used prices: ${productName}...`);

    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${firecrawlApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: searchUrl,
        formats: ["markdown"],
      }),
    });

    if (!response.ok) {
      console.error("Firecrawl error for Finn.no:", await response.text());
      return null;
    }

    const data = await response.json();
    const markdown = data.data?.markdown || "";

    // Extract all prices from listings
    const pricePattern = /(\d{1,3}(?:[\s.]?\d{3})*)\s*kr/gi;
    const matches = [...markdown.matchAll(pricePattern)];
    const prices = matches
      .map(m => parseInt(m[1].replace(/[\s.]/g, ""), 10))
      .filter(p => p > 100 && p < 100000); // Filter out outliers

    if (prices.length === 0) {
      console.log("No used prices found on Finn.no");
      return null;
    }

    prices.sort((a, b) => a - b);
    
    // Get 25th and 75th percentile for more realistic range
    const low = prices[Math.floor(prices.length * 0.25)];
    const high = prices[Math.floor(prices.length * 0.75)];

    console.log(`Finn.no used price range: ${low} - ${high} kr`);

    return { low, high };
  } catch (error) {
    console.error("Error scraping Finn.no:", error);
    return null;
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

    console.log("Starting price update...");

    // Get all products
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, name, slug");

    if (productsError) {
      console.error("Error fetching products:", productsError);
      throw productsError;
    }

    console.log(`Found ${products?.length || 0} products to update`);

    const updateResults = [];

    for (const product of products as Product[]) {
      console.log(`\nUpdating prices for: ${product.name}`);
      
      const scrapedPrices: ScrapedPrice[] = [];

      // Scrape from each store
      for (const [storeName, urlGenerator] of Object.entries(STORE_SEARCH_URLS)) {
        const storeUrl = urlGenerator(product.name);
        const price = await scrapePrice(storeUrl, storeName, product.name);
        
        if (price) {
          scrapedPrices.push(price);
        }

        // Rate limiting - wait 2 seconds between requests
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Update merchant offers if we found prices
      if (scrapedPrices.length > 0) {
        // Delete old offers for this product
        await supabase
          .from("merchant_offers")
          .delete()
          .eq("product_id", product.id)
          .eq("condition", "new");

        // Insert new offers
        const offersToInsert = scrapedPrices.map(sp => ({
          product_id: product.id,
          merchant_name: sp.merchant_name,
          price: sp.price,
          url: sp.url,
          condition: sp.condition,
        }));

        const { error: insertError } = await supabase
          .from("merchant_offers")
          .insert(offersToInsert);

        if (insertError) {
          console.error(`Error inserting offers for ${product.name}:`, insertError);
        } else {
          console.log(`Inserted ${scrapedPrices.length} offers for ${product.name}`);
        }

        // Update product with new price range
        const prices = scrapedPrices.map(sp => sp.price);
        const newPriceLow = Math.min(...prices);
        const newPriceHigh = Math.max(...prices);

        await supabase
          .from("products")
          .update({
            new_price_low: newPriceLow,
            new_price_high: newPriceHigh,
          })
          .eq("id", product.id);
      }

      // Scrape Finn.no for used prices
      const usedPrices = await scrapeFinnNo(product.name);
      if (usedPrices) {
        await supabase
          .from("products")
          .update({
            used_price_low: usedPrices.low,
            used_price_high: usedPrices.high,
          })
          .eq("id", product.id);
      }

      updateResults.push({
        product: product.name,
        new_offers: scrapedPrices.length,
        used_price_found: !!usedPrices,
      });

      // Wait before next product
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return new Response(
      JSON.stringify({
        message: "Prices updated successfully",
        results: updateResults,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in update-prices function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
