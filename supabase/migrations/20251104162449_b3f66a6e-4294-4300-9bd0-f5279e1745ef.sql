-- Add is_valid flag to merchant_listings to mark suspicious prices
ALTER TABLE merchant_listings 
ADD COLUMN IF NOT EXISTS is_valid BOOLEAN DEFAULT true;

-- Create a function to validate prices based on product category
CREATE OR REPLACE FUNCTION validate_listing_price()
RETURNS TRIGGER AS $$
DECLARE
  product_category TEXT;
  min_price INTEGER;
  max_price INTEGER;
BEGIN
  -- Get the product category
  SELECT p.category INTO product_category
  FROM products p
  JOIN product_variants pv ON p.id = pv.product_id
  WHERE pv.id = NEW.variant_id;

  -- Set price thresholds based on category
  CASE product_category
    WHEN 'smartphone' THEN
      min_price := 3000;  -- Minimum for smartphones (3000 kr)
      max_price := 30000; -- Maximum for smartphones (30000 kr)
    ELSE
      min_price := 0;
      max_price := 999999;
  END CASE;

  -- Mark as invalid if price is outside reasonable range
  IF NEW.price < min_price OR NEW.price > max_price THEN
    NEW.is_valid := false;
  ELSE
    NEW.is_valid := true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate prices on insert/update
DROP TRIGGER IF EXISTS validate_listing_price_trigger ON merchant_listings;
CREATE TRIGGER validate_listing_price_trigger
  BEFORE INSERT OR UPDATE ON merchant_listings
  FOR EACH ROW
  EXECUTE FUNCTION validate_listing_price();

-- Mark existing invalid prices
UPDATE merchant_listings ml
SET is_valid = false
WHERE ml.price < 3000
  AND EXISTS (
    SELECT 1 FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    WHERE pv.id = ml.variant_id AND p.category = 'smartphone'
  );