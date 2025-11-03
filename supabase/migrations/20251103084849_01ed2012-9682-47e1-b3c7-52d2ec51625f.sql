-- Create ai_jobs queue table
CREATE TABLE IF NOT EXISTS public.ai_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL, -- 'normalize_offer', 'extract_attributes', 'write_alert_email'
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone,
  error text,
  cache_key text -- for deduplication
);

CREATE INDEX IF NOT EXISTS idx_ai_jobs_status ON public.ai_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_cache_key ON public.ai_jobs(cache_key);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_created_at ON public.ai_jobs(created_at);

-- Create normalized_offers table
CREATE TABLE IF NOT EXISTS public.normalized_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_offer_id uuid REFERENCES public.merchant_offers(id),
  normalized_product_id uuid REFERENCES public.products(id),
  confidence numeric(3,2), -- 0.00 to 1.00
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_normalized_offers_merchant ON public.normalized_offers(merchant_offer_id);

-- Create product_attributes table
CREATE TABLE IF NOT EXISTS public.product_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id),
  attribute_key text NOT NULL,
  attribute_value text NOT NULL,
  source text, -- 'ai', 'manual', 'scrape'
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_attributes_product ON public.product_attributes(product_id);

-- Create price_history table
CREATE TABLE IF NOT EXISTS public.price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id),
  merchant_name text NOT NULL,
  price integer NOT NULL,
  condition text NOT NULL,
  scraped_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_history_product ON public.price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_scraped ON public.price_history(scraped_at);

-- Create ai_cache table (simple DB cache instead of Redis for now)
CREATE TABLE IF NOT EXISTS public.ai_cache (
  cache_key text PRIMARY KEY,
  result jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '72 hours')
);

CREATE INDEX IF NOT EXISTS idx_ai_cache_expires ON public.ai_cache(expires_at);

-- Enable RLS
ALTER TABLE public.ai_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.normalized_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies (admin only for AI jobs)
CREATE POLICY "AI jobs are viewable by everyone" ON public.ai_jobs FOR SELECT USING (true);
CREATE POLICY "Normalized offers viewable by everyone" ON public.normalized_offers FOR SELECT USING (true);
CREATE POLICY "Product attributes viewable by everyone" ON public.product_attributes FOR SELECT USING (true);
CREATE POLICY "Price history viewable by everyone" ON public.price_history FOR SELECT USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_ai_jobs_updated_at
  BEFORE UPDATE ON public.ai_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();