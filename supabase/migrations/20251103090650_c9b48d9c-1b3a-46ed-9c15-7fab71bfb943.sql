-- Remove Unsplash-related columns from products table
ALTER TABLE products 
DROP COLUMN photographer_name,
DROP COLUMN photographer_username,
DROP COLUMN photo_download_location;