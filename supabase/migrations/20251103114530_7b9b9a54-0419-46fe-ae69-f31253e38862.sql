-- Add merchant offers for Google Pixel 8 Pro
INSERT INTO merchant_offers (product_id, merchant_name, price, condition, url) VALUES 
('1ddec1ad-b7d2-45d5-860b-ff3753f91024', 'Elkjøp', 10990, 'new', 'https://www.elkjop.no/product/mobil-og-klokke/mobiltelefon/PIXEL8PRO'),
('1ddec1ad-b7d2-45d5-860b-ff3753f91024', 'Komplett', 10690, 'new', 'https://www.komplett.no/product/1234567'),
('1ddec1ad-b7d2-45d5-860b-ff3753f91024', 'Power', 11290, 'new', 'https://www.power.no/mobil/google-pixel-8-pro'),
('1ddec1ad-b7d2-45d5-860b-ff3753f91024', 'Expert', 10890, 'new', 'https://www.expert.no/google-pixel-8-pro');

-- Update product price ranges
UPDATE products 
SET new_price_low = 10690, new_price_high = 11290 
WHERE id = '1ddec1ad-b7d2-45d5-860b-ff3753f91024';