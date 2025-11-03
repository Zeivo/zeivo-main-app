-- Update iPhone 15 Pro with Apple's official product image
UPDATE products 
SET 
  image = 'https://www.apple.com/newsroom/images/2023/09/apple-unveils-iphone-15-pro-and-iphone-15-pro-max/article/Apple-iPhone-15-Pro-lineup-color-lineup-230912_big.jpg.large_2x.jpg',
  photographer_name = NULL,
  photographer_username = NULL,
  photo_download_location = NULL
WHERE slug = 'iphone-15-pro';

-- Update AirPods Pro with Apple's official product image
UPDATE products 
SET 
  image = 'https://cdsassets.apple.com/live/7WUAS350/images/tech-specs/airpods-pro-2.png',
  photographer_name = NULL,
  photographer_username = NULL,
  photo_download_location = NULL
WHERE slug = 'airpods-pro';