
-- Remove AI-generated images
UPDATE products SET image = NULL WHERE image LIKE 'data:image%';
