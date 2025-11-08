# Price Scraping and Normalization Strategy

## Current Issues

1. **Single Firecrawl request per product** - scrapes Finn.no search results but doesn't follow individual listings
2. **Poor parsing** - relies on regex to extract prices from markdown, missing structure and individual listing URLs
3. **All listings go to first variant** - no intelligent variant matching
4. **Price averaging loses granularity** - shows single price rather than range or individual offers
5. **Only 1 merchant** (Finn.no) - no retailer diversity

## Strategic Solution: Multi-Tier Price Intelligence System

### Core Principle
Extract maximum value from <100 Firecrawl requests per day by using AI to process batches of data intelligently, providing users with rich price insights rather than simple averages.

---

## Part 1: Tiered Scraping Approach

### Tier 1: Daily Full Scrapes (20-30 requests/day)
- High-priority products (most viewed, most price alerts)
- Scrape Finn.no search results (1 request per product)
- Extract ALL individual listings with their URLs from the markdown
- Parse structured data: title, price, URL for each listing

### Tier 2: Deep Dives (30-50 requests/day)
- Follow top 3-5 individual Finn.no listing pages for high-priority products
- Each listing page = 1 Firecrawl request
- Extract detailed specs: exact storage/color, seller info, condition details, photos

### Tier 3: Retailer Checks (20-30 requests/day)
- Major Norwegian retailers: Power.no, Elkjøp.no, Komplett.no, Proshop.no
- Use direct product URLs stored in database (not search results)
- One product page per request

### Request Budgeting Logic

```
Priority Score = (page_views * 2) + (active_price_alerts * 5) + (days_since_update * -0.5)

Daily allocation:
- Sort products by priority score
- Tier 1: Top 20-30 products get search page scrapes
- Tier 2: Top 5-10 products get individual listing scrapes (5 listings each)
- Tier 3: Rotate through retailers (5 products × 4 retailers = 20 requests)
```

---

## Part 2: AI-Powered Batch Processing (The Value-Add)

### Problem with Finn.no
Finn.no gives you 10-50 listings per product, all marked "used". Current system picks one or averages them, losing all the nuance.

### Solution: Single AI Call Processes All Listings

**Input to Vertex AI (Gemini 2.5 Flash):**
```json
{
  "product": "iPhone 15 Pro",
  "known_variants": [
    { "id": "abc", "storage": 128, "color": "Natural Titanium" },
    { "id": "def", "storage": 256, "color": "Black Titanium" }
  ],
  "finn_listings": [
    { "title": "iPhone 15 Pro 256GB Svart, perfekt stand", "price": 8500, "url": "https://..." },
    { "title": "iPhone 15 pro 128 gb natur titanium", "price": 7200, "url": "https://..." },
    // ... 20 more listings extracted from search results
  ]
}
```

**Output from Vertex AI:**
```json
{
  "matched_listings": [
    {
      "variant_id": "def",
      "listings": [
        {
          "finn_listing_index": 0,
          "confidence": 0.95,
          "condition_quality": "like_new",
          "price": 8500,
          "url": "https://..."
        },
        {
          "finn_listing_index": 5,
          "confidence": 0.85,
          "condition_quality": "good",
          "price": 8000,
          "url": "https://..."
        }
      ],
      "price_range": { "min": 7500, "max": 9000, "median": 8200 },
      "quality_tiers": {
        "excellent": { "min": 8500, "max": 8700, "count": 2 },
        "good": { "min": 8000, "max": 8200, "count": 5 },
        "acceptable": { "min": 7500, "max": 7800, "count": 3 }
      }
    },
    {
      "variant_id": "abc",
      "listings": [
        {
          "finn_listing_index": 1,
          "confidence": 0.92,
          "condition_quality": "good",
          "price": 7200,
          "url": "https://..."
        }
      ],
      "price_range": { "min": 6800, "max": 7500, "median": 7200 },
      "quality_tiers": {
        "excellent": { "min": 7400, "max": 7500, "count": 1 },
        "good": { "min": 7000, "max": 7200, "count": 4 },
        "acceptable": { "min": 6800, "max": 7000, "count": 2 }
      }
    }
  ],
  "unmatched_listings": [2, 8, 15],
  "market_insights": {
    "summary": "Strong supply for 256GB, limited 128GB availability",
    "price_trend": "stable",
    "best_value_tier": "good",
    "recommendation": "Best deals are in 'good' condition tier for 256GB variant"
  }
}
```

### Benefits of This Approach
- 1 Firecrawl request → 20+ listings analyzed
- AI groups by variant automatically
- Provides price ranges instead of averages
- Quality-based price tiers (excellent/good/acceptable condition)
- Market insights for users
- Each listing tracked individually with URL

---

## Part 3: Database Schema Updates

### New Fields in `merchant_listings` Table
```sql
-- Add these columns
price_tier VARCHAR  -- 'excellent', 'good', 'acceptable'
listing_group_id UUID  -- Groups listings from same scrape batch
market_insight TEXT  -- Store AI-generated insight for this listing group
listing_count INTEGER  -- How many listings in this price tier
price_min INTEGER  -- Min price for this tier
price_max INTEGER  -- Max price for this tier
```

### New Table: `merchant_urls`
```sql
CREATE TABLE merchant_urls (
  id UUID PRIMARY KEY,
  merchant_name VARCHAR,
  product_id UUID REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  url TEXT,
  scrape_priority INTEGER DEFAULT 5,
  last_scraped_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### New Table: `scrape_budget`
```sql
CREATE TABLE scrape_budget (
  id UUID PRIMARY KEY,
  date DATE,
  requests_used INTEGER DEFAULT 0,
  requests_limit INTEGER DEFAULT 100,
  tier1_used INTEGER DEFAULT 0,
  tier2_used INTEGER DEFAULT 0,
  tier3_used INTEGER DEFAULT 0,
  created_at TIMESTAMP
);
```

### New Fields in `product_variants` Table
```sql
-- Instead of single prices, track structured data
price_data JSONB  -- Store complete pricing structure
-- Example structure:
{
  "new": {
    "merchants": [
      {"name": "Elkjøp", "price": 10990, "url": "...", "updated": "2025-01-08"},
      {"name": "Power", "price": 11290, "url": "...", "updated": "2025-01-07"}
    ],
    "best_price": 10890,
    "best_merchant": "Komplett"
  },
  "used": {
    "source": "Finn.no",
    "tiers": {
      "excellent": {"min": 8500, "max": 9200, "count": 3},
      "good": {"min": 7800, "max": 8400, "count": 8},
      "acceptable": {"min": 7000, "max": 7700, "count": 4}
    },
    "total_listings": 15,
    "median_price": 8100,
    "recommendation": "Best value in 'good' tier"
  },
  "updated_at": "2025-01-08T10:30:00Z"
}
```

---

## Part 4: Multi-Merchant Strategy

### Finn.no (Used Market)
- 1 search page per product = 1 Firecrawl request
- Extract 20-50 individual listings per request
- AI processes all at once → multiple variants, price ranges
- Update frequency based on priority score

### Major Retailers (New Market)
- **Don't scrape search results** - too expensive
- Store direct product URLs in `merchant_urls` table (one-time manual seeding or automated discovery)
- Scrape 1 product page = 1 Firecrawl request
- Example URL: `https://www.elkjop.no/product/mobil-og-nettbrett/mobiltelefon/APIPHN15P256NT/iphone-15-pro-256-gb-natural-titanium`

### Daily Rotation Strategy
```
Day 1: Scrape Elkjøp for top 20 products (20 requests)
Day 2: Scrape Power for top 20 products (20 requests)
Day 3: Scrape Komplett for top 20 products (20 requests)
Day 4: Scrape Proshop for top 20 products (20 requests)
Day 5: Repeat cycle

Each product gets updated from each retailer once per week.
High-priority products can be scraped more frequently.
```

### Price Freshness Guidelines
```
Finn.no used prices:
- High priority (priority_score > 50): Daily
- Medium priority (20-50): Every 3 days
- Low priority (<20): Weekly

Retailer new prices:
- High priority: 2-3 retailers per day
- Medium priority: 1 retailer per day
- Low priority: 1 retailer every 4 days
```

---

## Part 5: Improved Variant Matching

### Current Problem
All Finn listings → first variant regardless of specs

### Solution: AI-Powered Variant Disambiguation

**Step 1: Generate Matching Rules**
When creating/updating product variants, generate matching rules:
```json
{
  "variant_id": "abc",
  "storage_gb": 128,
  "color": "Natural Titanium",
  "matching_rules": {
    "storage_keywords": ["128gb", "128 gb", "128", "128gb"],
    "color_keywords": ["natural", "natur", "titan", "titanium", "beige", "guld"],
    "exclusion_keywords": ["256gb", "512gb", "black", "svart", "blue", "blå"]
  }
}
```

**Step 2: AI Matching Prompt**
```
You are matching product listings to specific variants.

Product: iPhone 15 Pro
Variants:
1. ID: abc - 128GB Natural Titanium
   - Storage keywords: ["128gb", "128 gb", "128"]
   - Color keywords: ["natural", "natur", "titan", "beige"]
   - Exclusions: ["256gb", "black", "svart"]

2. ID: def - 256GB Black Titanium
   - Storage keywords: ["256gb", "256 gb", "256"]
   - Color keywords: ["black", "svart", "sort", "titan"]
   - Exclusions: ["128gb", "512gb", "natural", "white"]

Listings to match:
1. "iPhone 15 Pro 256GB Svart, perfekt stand" - 8500 kr
2. "iPhone 15 pro 128 gb natur titanium" - 7200 kr
3. "iPhone 15 Pro 128gb" - 7000 kr (no color mentioned)

For each listing, return:
- variant_id: Which variant it matches (or "unknown")
- confidence: 0.0-1.0
- reason: Brief explanation
- condition_quality: "excellent", "good", "acceptable", or "poor"
```

**Step 3: Store with Confidence Threshold**
- Only store listings with confidence > 0.7
- Listings with 0.5-0.7 confidence: Flag for manual review
- Listings with <0.5 confidence: Discard

---

## Part 6: Display Strategy for Maximum User Value

### Variant Card - New Layout

```
iPhone 15 Pro - 256GB Natural Titanium

┌─────────────────────────────────────────┐
│ NYE PRODUKTER                           │
├─────────────────────────────────────────┤
│ Elkjøp.no       10 990 kr   [Se tilbud] │
│ Power.no        11 290 kr   [Se tilbud] │
│ Komplett.no     10 890 kr   [Se tilbud] │
│                                         │
│ ✅ Beste pris: 10 890 kr                │
│ Oppdatert: I går                        │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ BRUKTE PRODUKTER (Finn.no)              │
├─────────────────────────────────────────┤
│ 📊 15 tilbud funnet                      │
│                                         │
│ ⭐ Utmerket stand                       │
│    8 500 - 9 200 kr                    │
│    [Se 3 tilbud]                       │
│                                         │
│ ✓ God stand                             │
│    7 800 - 8 400 kr                    │
│    [Se 8 tilbud]                       │
│                                         │
│ ✓ Akseptabel stand                      │
│    7 000 - 7 700 kr                    │
│    [Se 4 tilbud]                       │
│                                         │
│ 💡 AI-anbefaling:                       │
│ "Beste verdi i 'God stand' kategorien.  │
│  Priser er stabile siste 7 dager."     │
│                                         │
│ Median pris: 8 100 kr                  │
│ Oppdatert: I dag kl 10:30              │
└─────────────────────────────────────────┘
```

### Expandable Listing Details

When user clicks "Se 8 tilbud" for "God stand":
```
┌─────────────────────────────────────────┐
│ God stand - 8 tilbud                    │
├─────────────────────────────────────────┤
│ 7 800 kr  [Åpne på Finn.no] →          │
│ "iPhone 15 Pro 256GB svart, lite brukt" │
│                                         │
│ 7 900 kr  [Åpne på Finn.no] →          │
│ "iPhone 15 pro 256 gb sort"            │
│                                         │
│ 8 000 kr  [Åpne på Finn.no] →          │
│ "iPhone 15 Pro 256GB"                  │
│                                         │
│ ... (5 more listings)                  │
└─────────────────────────────────────────┘
```

### Component Structure Updates

**VariantCard component should render:**
1. New products section (if any retailer prices exist)
   - List each merchant with price
   - Highlight best price
   - Show last update timestamp

2. Used products section (if Finn.no data exists)
   - Show total listing count
   - Display price tiers (excellent/good/acceptable)
   - Each tier: price range + listing count + expandable link
   - Show AI recommendation
   - Show median price and update timestamp

**ListingCard component variations:**
- **RetailerListingCard**: Direct product page link, merchant logo, price
- **FinnTierCard**: Collapsible card showing tier summary
- **FinnIndividualListingCard**: Individual Finn listing with title, price, link to Finn.no

---

## Part 7: Implementation Architecture

### Update-Prices Function (Refactored)

```javascript
// Core workflow:

1. Check daily Firecrawl budget
   - Query scrape_budget table for today
   - Calculate remaining requests

2. Calculate priority scores for all products
   - Fetch page views, price alerts, last update time
   - Sort by priority

3. Allocate Tier 1 budget (20-30 requests)
   - Select top N products
   - Scrape Finn.no search pages
   - Parse ALL individual listings from markdown
   - Store raw listings in temp array

4. Process Tier 1 data with AI (batch)
   - For each product, send ALL listings to Vertex AI in one call
   - AI returns matched variants + price tiers + insights
   - Store results in merchant_listings table
   - Update product_variants.price_data JSON field

5. Allocate Tier 2 budget (30-50 requests)
   - Select top 5-10 products
   - For each: scrape 3-5 individual Finn listing pages
   - Extract detailed specs, photos, seller info
   - Process with AI for quality assessment
   - Update existing merchant_listings with enhanced data

6. Allocate Tier 3 budget (20-30 requests)
   - Query merchant_urls for due scrapes
   - Rotate through retailers
   - Scrape product pages
   - Extract prices, availability, specs
   - Store in merchant_listings table
   - Update product_variants.price_data

7. Update scrape_budget table
   - Record total requests used
   - Record per-tier usage

8. Return summary stats
```

### AI-Worker Function (Enhanced)

```javascript
// New job types:

1. "batch_normalize_finn_listings"
   - Input: product_id, variant_ids[], finn_listings[]
   - Output: matched_listings[], unmatched_listings[], insights
   - Store results in merchant_listings + price_data

2. "assess_listing_quality"
   - Input: listing_title, listing_description, photos[]
   - Output: condition_quality ("excellent"/"good"/"acceptable"/"poor"), confidence
   - Update merchant_listings.price_tier

3. "generate_market_insights"
   - Input: product_id, all_listings[]
   - Output: summary, trend, recommendation
   - Store in product_variants.price_data.used.recommendation

4. Existing job types remain unchanged
```

### New Edge Function: Budget-Manager

```javascript
// Endpoint: /budget-manager

Purpose:
- Track Firecrawl request usage in real-time
- Prevent exceeding 100 requests/day
- Provide budget allocation recommendations

Methods:
- checkBudget() → returns remaining requests for today
- allocateBudget(tier, count) → reserves requests, returns approval
- recordUsage(tier, count) → logs actual usage
- getRecommendations() → suggests optimal allocation based on priorities
```

---

## Part 8: AI Prompt Templates

### Template 1: Batch Finn.no Listing Normalization

```
System Prompt:
You are a product matching AI for a Norwegian price comparison platform. Your task is to match merchant listings to product variants with high accuracy.

User Prompt:
Product: {product_name}
Category: {category}

Available Variants:
{json_array_of_variants_with_specs}

Finn.no Listings:
{json_array_of_listings}

Tasks:
1. Match each listing to a variant (or mark as unmatched)
2. Assess listing quality based on title/description
3. Group listings by variant
4. Calculate price ranges and tiers per variant
5. Generate market insights

Return JSON with this exact structure:
{
  "matched_listings": [
    {
      "variant_id": "uuid",
      "listings": [
        {
          "finn_listing_index": 0,
          "confidence": 0.95,
          "condition_quality": "excellent|good|acceptable|poor",
          "price": 8500,
          "url": "https://..."
        }
      ],
      "price_range": {"min": 7500, "max": 9000, "median": 8200},
      "quality_tiers": {
        "excellent": {"min": 8500, "max": 8700, "count": 2},
        "good": {"min": 8000, "max": 8200, "count": 5},
        "acceptable": {"min": 7500, "max": 7800, "count": 3}
      }
    }
  ],
  "unmatched_listings": [2, 8, 15],
  "market_insights": {
    "summary": "text",
    "price_trend": "increasing|decreasing|stable",
    "best_value_tier": "excellent|good|acceptable",
    "recommendation": "text"
  }
}

Quality Assessment Guidelines:
- "excellent": Words like "ny", "ubrukt", "perfekt", "som ny", "original emballasje"
- "good": Words like "lite brukt", "god stand", "fungerer perfekt", "ingen skader"
- "acceptable": Words like "brukt", "noen skader", "normal slitasje"
- "poor": Words like "defekt", "ødelagt", "ikke fungerende", "reparasjon"

Matching Rules:
- Storage: Look for GB numbers (128, 256, 512, 1TB)
- Color: Norwegian and English color names
- Confidence >0.9: Exact match on storage + color
- Confidence 0.7-0.9: Match on storage OR color
- Confidence <0.7: Uncertain, mark as unmatched
```

### Template 2: Retailer Price Extraction

```
System Prompt:
Extract product pricing and availability from Norwegian retailer website markdown.

User Prompt:
Product: {product_name}
Variant: {variant_specs}
Merchant: {merchant_name}
Page Markdown:
{firecrawl_markdown}

Tasks:
1. Find the product price (look for kr, NOK, price patterns)
2. Determine availability (in stock, out of stock, pre-order)
3. Extract any promotional info
4. Verify this is the correct product/variant

Return JSON:
{
  "price": 10990,
  "availability": "in_stock|out_of_stock|pre_order|limited_stock",
  "promotion": "text or null",
  "match_confidence": 0.95,
  "match_reason": "explanation"
}

If price not found or wrong product, return:
{
  "price": null,
  "availability": "unknown",
  "match_confidence": 0.0,
  "match_reason": "explanation"
}
```

### Template 3: Market Insights Generation

```
System Prompt:
Generate user-friendly market insights in Norwegian based on pricing data.

User Prompt:
Product: {product_name}
Variant: {variant_specs}

Pricing Data:
{json_with_all_listings_and_tiers}

Tasks:
1. Summarize market availability
2. Identify price trends (if historical data available)
3. Recommend best value tier
4. Provide actionable advice

Return JSON:
{
  "summary": "Short Norwegian sentence about supply/demand",
  "price_trend": "stable|increasing|decreasing",
  "best_value_tier": "excellent|good|acceptable|new_from_elkjop",
  "recommendation": "1-2 sentence Norwegian recommendation",
  "confidence": 0.85
}

Example Output:
{
  "summary": "God tilgjengelighet med 15 tilbud på bruktmarkedet",
  "price_trend": "stable",
  "best_value_tier": "good",
  "recommendation": "Beste verdi finner du i 'God stand' kategorien. Priser har vært stabile siste uken.",
  "confidence": 0.92
}
```

---

## Part 9: Success Metrics

### Before → After Comparison

| Metric | Current | Target |
|--------|---------|--------|
| Listings per variant | 1 | 5-15 |
| Merchants per product | 1 (Finn.no) | 4-5 |
| Price display | Single average | Range with tiers |
| Variant matching accuracy | ~30% (all to first variant) | >85% |
| Firecrawl requests/day | ~30 (inefficient) | <100 (optimized) |
| Data freshness | Varies | Priority-based |
| User value | Low (simple average) | High (insights + ranges) |

### Key Performance Indicators

1. **Data Richness Score**: Average listings per variant
2. **Budget Efficiency**: Data points extracted per Firecrawl request
3. **Matching Accuracy**: % of listings correctly matched to variants
4. **User Engagement**: Time spent on product pages, click-through rate to merchants
5. **Competitive Advantage**: Unique insights provided vs. competitors

---

## Part 10: Phased Rollout Plan

### Phase 1: Enhanced Finn.no Processing
**Goal**: Get more value from existing Firecrawl usage

1. Improve markdown parsing to extract ALL listings from search results
2. Implement batch AI processing for variant matching
3. Add price_tier field to merchant_listings
4. Store individual listings instead of averaging
5. Update Product.tsx to display price ranges

**Deliverables**:
- Refactored update-prices function
- New AI prompt for batch normalization
- Updated database schema
- Updated frontend to show ranges

**Firecrawl Impact**: Same ~30 requests/day, but 10x more data extracted

### Phase 2: Multi-Merchant Integration
**Goal**: Add retailer price data

1. Create merchant_urls table
2. Manually seed URLs for top 50 products × 4 retailers
3. Implement Tier 3 scraping with rotation
4. Store retailer prices in merchant_listings
5. Update product_variants.price_data JSON field
6. Display new products section in UI

**Deliverables**:
- Merchant URL seeding script
- Rotating scraper implementation
- Retailer price display components

**Firecrawl Impact**: +20 requests/day (total ~50/day)

### Phase 3: Priority System & Budget Management
**Goal**: Intelligent request allocation

1. Create scrape_budget table
2. Implement priority scoring algorithm
3. Build budget-manager Edge Function
4. Add real-time usage tracking
5. Implement dynamic allocation in update-prices

**Deliverables**:
- Budget tracking dashboard in Admin panel
- Priority-based scraping logic
- Usage alerts and recommendations

**Firecrawl Impact**: Up to 100 requests/day, optimally allocated

### Phase 4: Advanced Features
**Goal**: Maximum user value

1. Implement Tier 2 (deep dive) scraping for top products
2. Add condition quality assessment
3. Generate market insights with AI
4. Add price history tracking
5. Implement price trend analysis

**Deliverables**:
- Enhanced listing details
- Market insights display
- Price history graphs
- Trend indicators

**Firecrawl Impact**: Full 100 requests/day with maximum ROI

---

## Summary

This strategy transforms Zeivo from a basic price scraper into an intelligent market analysis platform. The key innovations are:

1. **Batch AI Processing**: One Firecrawl request → 20+ analyzed listings
2. **Price Ranges, Not Averages**: Show users the full market picture
3. **Quality Tiers**: Group used products by condition for better decision-making
4. **Multi-Merchant Coverage**: Compare new and used prices across all major sources
5. **Priority-Based Scraping**: Focus budget on high-value products
6. **Market Insights**: AI-generated recommendations provide unique value

By staying under 100 Firecrawl requests per day while extracting 10-20x more value per request, this approach is both cost-effective and highly differentiated from competitors who simply scrape and average prices.

The competitive advantage is clear: **Zeivo doesn't just show prices—it provides market intelligence that helps users make smarter buying decisions.**
