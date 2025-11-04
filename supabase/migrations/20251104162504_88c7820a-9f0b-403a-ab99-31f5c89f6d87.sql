-- Fix the function security by setting search_path
CREATE OR REPLACE FUNCTION validate_listing_price()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;