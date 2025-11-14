-- Drop the foreign key constraint and product_id column
ALTER TABLE merchant_urls DROP CONSTRAINT IF EXISTS merchant_urls_product_id_fkey;
ALTER TABLE merchant_urls DROP COLUMN IF EXISTS product_id;

-- Add category column
ALTER TABLE merchant_urls ADD COLUMN category text NOT NULL DEFAULT '';

-- Update the category column to be non-empty (remove default after)
ALTER TABLE merchant_urls ALTER COLUMN category DROP DEFAULT;