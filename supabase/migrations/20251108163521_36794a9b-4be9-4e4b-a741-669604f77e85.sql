-- Add new fields to merchant_listings for price tiers and grouping
ALTER TABLE merchant_listings 
ADD COLUMN IF NOT EXISTS price_tier TEXT,
ADD COLUMN IF NOT EXISTS listing_group_id UUID,
ADD COLUMN IF NOT EXISTS market_insight TEXT,
ADD COLUMN IF NOT EXISTS listing_count INTEGER,
ADD COLUMN IF NOT EXISTS price_min INTEGER,
ADD COLUMN IF NOT EXISTS price_max INTEGER;

-- Add price_data JSONB field to product_variants for structured pricing
ALTER TABLE product_variants 
ADD COLUMN IF NOT EXISTS price_data JSONB;

-- Create index on listing_group_id for faster queries
CREATE INDEX IF NOT EXISTS idx_merchant_listings_group_id ON merchant_listings(listing_group_id);

-- Create index on price_tier for filtering
CREATE INDEX IF NOT EXISTS idx_merchant_listings_price_tier ON merchant_listings(price_tier);