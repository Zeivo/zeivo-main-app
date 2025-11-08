-- Phase 2 & 3: Add merchant URLs tracking
CREATE TABLE IF NOT EXISTS public.merchant_urls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_name TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  url_type TEXT NOT NULL CHECK (url_type IN ('search', 'direct')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_scraped_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(merchant_name, product_id, url_type)
);

-- Phase 3: Add scraping budget tracking
CREATE TABLE IF NOT EXISTS public.scrape_budget (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  budget_total INTEGER NOT NULL DEFAULT 100,
  budget_used INTEGER NOT NULL DEFAULT 0,
  budget_remaining INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Phase 3: Add priority and scraping frequency to products
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS priority_score INTEGER DEFAULT 50 CHECK (priority_score >= 0 AND priority_score <= 100),
ADD COLUMN IF NOT EXISTS last_scraped_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS scrape_frequency_hours INTEGER DEFAULT 24;

-- Enable RLS on new tables
ALTER TABLE public.merchant_urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scrape_budget ENABLE ROW LEVEL SECURITY;

-- RLS policies for merchant_urls
CREATE POLICY "Merchant URLs viewable by everyone"
  ON public.merchant_urls FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert merchant URLs"
  ON public.merchant_urls FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update merchant URLs"
  ON public.merchant_urls FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete merchant URLs"
  ON public.merchant_urls FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for scrape_budget
CREATE POLICY "Scrape budget viewable by admins"
  ON public.scrape_budget FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert scrape budget"
  ON public.scrape_budget FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update scrape budget"
  ON public.scrape_budget FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_merchant_urls_product_id ON public.merchant_urls(product_id);
CREATE INDEX IF NOT EXISTS idx_merchant_urls_merchant_name ON public.merchant_urls(merchant_name);
CREATE INDEX IF NOT EXISTS idx_merchant_urls_is_active ON public.merchant_urls(is_active);
CREATE INDEX IF NOT EXISTS idx_scrape_budget_date ON public.scrape_budget(date);
CREATE INDEX IF NOT EXISTS idx_products_priority_score ON public.products(priority_score);
CREATE INDEX IF NOT EXISTS idx_products_last_scraped_at ON public.products(last_scraped_at);

-- Trigger for updated_at on merchant_urls
CREATE TRIGGER update_merchant_urls_updated_at
  BEFORE UPDATE ON public.merchant_urls
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Trigger for updated_at on scrape_budget
CREATE TRIGGER update_scrape_budget_updated_at
  BEFORE UPDATE ON public.scrape_budget
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();