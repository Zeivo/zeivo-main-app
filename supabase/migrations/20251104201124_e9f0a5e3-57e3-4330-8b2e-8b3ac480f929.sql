
-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS validate_listing_price_trigger ON merchant_listings;
DROP FUNCTION IF EXISTS validate_listing_price();

-- Recreate the validation function with correct category matching
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

  -- Set price thresholds based on category (using LIKE for flexible matching)
  IF product_category LIKE '%Mobiltelefoner%' OR product_category LIKE '%smartphone%' THEN
    min_price := 3000;  -- Minimum for smartphones (3000 kr)
    max_price := 30000; -- Maximum for smartphones (30000 kr)
  ELSIF product_category LIKE '%Laptop%' THEN
    min_price := 3000;
    max_price := 50000;
  ELSIF product_category LIKE '%Spillkonsoller%' OR product_category LIKE '%Gaming%' THEN
    min_price := 2000;
    max_price := 10000;
  ELSIF product_category LIKE '%Støvsuger%' OR product_category LIKE '%Vacuum%' THEN
    min_price := 1000;
    max_price := 15000;
  ELSIF product_category LIKE '%Hodetelefoner%' OR product_category LIKE '%Headphones%' THEN
    min_price := 300;
    max_price := 8000;
  ELSE
    -- Default for other categories
    min_price := 100;
    max_price := 100000;
  END IF;

  -- Mark as invalid if price is outside reasonable range
  IF NEW.price < min_price OR NEW.price > max_price THEN
    NEW.is_valid := false;
  ELSE
    NEW.is_valid := true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate the trigger
CREATE TRIGGER validate_listing_price_trigger
  BEFORE INSERT OR UPDATE ON merchant_listings
  FOR EACH ROW
  EXECUTE FUNCTION validate_listing_price();

-- Update existing listings to apply the new validation logic
UPDATE merchant_listings ml
SET is_valid = CASE
  WHEN p.category LIKE '%Mobiltelefoner%' OR p.category LIKE '%smartphone%' THEN
    ml.price >= 3000 AND ml.price <= 30000
  WHEN p.category LIKE '%Laptop%' THEN
    ml.price >= 3000 AND ml.price <= 50000
  WHEN p.category LIKE '%Spillkonsoller%' OR p.category LIKE '%Gaming%' THEN
    ml.price >= 2000 AND ml.price <= 10000
  WHEN p.category LIKE '%Støvsuger%' OR p.category LIKE '%Vacuum%' THEN
    ml.price >= 1000 AND ml.price <= 15000
  WHEN p.category LIKE '%Hodetelefoner%' OR p.category LIKE '%Headphones%' THEN
    ml.price >= 300 AND ml.price <= 8000
  ELSE
    ml.price >= 100 AND ml.price <= 100000
END
FROM product_variants pv
JOIN products p ON pv.product_id = p.id
WHERE ml.variant_id = pv.id;
