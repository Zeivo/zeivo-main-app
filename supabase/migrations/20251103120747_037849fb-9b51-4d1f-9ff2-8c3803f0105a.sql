-- Drop old tables to start fresh
DROP TABLE IF EXISTS price_alerts CASCADE;
DROP TABLE IF EXISTS normalized_offers CASCADE;
DROP TABLE IF EXISTS merchant_offers CASCADE;
DROP TABLE IF EXISTS product_attributes CASCADE;
DROP TABLE IF EXISTS products CASCADE;

-- Create products table (base product info)
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create product_variants table (storage, color, model combinations)
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  storage_gb INTEGER,
  color TEXT,
  model TEXT,
  price_new INTEGER,
  price_used INTEGER,
  availability TEXT DEFAULT 'unknown',
  confidence DECIMAL(3,2) DEFAULT 0.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, storage_gb, color, model)
);

-- Create merchant_listings table (individual retailer offers)
CREATE TABLE merchant_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  merchant_name TEXT NOT NULL,
  url TEXT,
  price INTEGER NOT NULL,
  condition TEXT NOT NULL CHECK (condition IN ('new', 'used')),
  confidence DECIMAL(3,2) DEFAULT 0.0,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_listings ENABLE ROW LEVEL SECURITY;

-- Public read access for all tables
CREATE POLICY "Products viewable by everyone" ON products FOR SELECT USING (true);
CREATE POLICY "Product variants viewable by everyone" ON product_variants FOR SELECT USING (true);
CREATE POLICY "Merchant listings viewable by everyone" ON merchant_listings FOR SELECT USING (true);

-- Create indexes for performance
CREATE INDEX idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_merchant_listings_variant_id ON merchant_listings(variant_id);
CREATE INDEX idx_merchant_listings_condition ON merchant_listings(condition);
CREATE INDEX idx_products_slug ON products(slug);

-- Create trigger for updated_at
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_product_variants_updated_at
  BEFORE UPDATE ON product_variants
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_merchant_listings_updated_at
  BEFORE UPDATE ON merchant_listings
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();