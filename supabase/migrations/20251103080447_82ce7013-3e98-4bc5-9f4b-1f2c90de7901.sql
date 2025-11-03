-- Add photographer attribution fields to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS photographer_name TEXT,
ADD COLUMN IF NOT EXISTS photographer_username TEXT,
ADD COLUMN IF NOT EXISTS photo_download_location TEXT;