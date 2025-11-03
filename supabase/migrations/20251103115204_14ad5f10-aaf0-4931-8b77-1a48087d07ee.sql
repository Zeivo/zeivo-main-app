-- Replace Expert with Netonnet merchant offer
UPDATE merchant_offers 
SET merchant_name = 'Netonnet', url = 'https://www.netonnet.no/google-pixel-8-pro'
WHERE product_id = '1ddec1ad-b7d2-45d5-860b-ff3753f91024' AND merchant_name = 'Expert';