-- Drop the old check constraint
ALTER TABLE merchant_urls DROP CONSTRAINT merchant_urls_url_type_check;

-- Add new check constraint with correct values
ALTER TABLE merchant_urls ADD CONSTRAINT merchant_urls_url_type_check 
CHECK (url_type IN ('category', 'product'));