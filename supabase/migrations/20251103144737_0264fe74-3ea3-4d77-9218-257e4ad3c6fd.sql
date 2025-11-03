-- Create merchants table
CREATE TABLE public.merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  region TEXT NOT NULL DEFAULT 'NO',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on merchants
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;

-- Allow everyone to view merchants
CREATE POLICY "Merchants viewable by everyone"
  ON public.merchants
  FOR SELECT
  USING (true);

-- Add new fields to products table
ALTER TABLE public.products
  ADD COLUMN brand TEXT,
  ADD COLUMN family TEXT,
  ADD COLUMN model TEXT;

-- Add new fields to product_variants table
ALTER TABLE public.product_variants
  ADD COLUMN ean TEXT,
  ADD COLUMN mpn TEXT,
  ADD COLUMN sku TEXT,
  ADD COLUMN image_url TEXT;

-- Create trigger for merchants updated_at
CREATE TRIGGER update_merchants_updated_at
  BEFORE UPDATE ON public.merchants
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();