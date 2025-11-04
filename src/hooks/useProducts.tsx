import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Product {
  id: string;
  name: string;
  image: string | null;
  category: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  storage_gb: number | null;
  color: string | null;
  model: string | null;
  price_new: number | null;
  price_used: number | null;
  availability: string;
  confidence: number;
  created_at: string;
  updated_at: string;
}

export interface MerchantListing {
  id: string;
  variant_id: string;
  merchant_name: string;
  url: string | null;
  price: number;
  condition: string;
  confidence: number;
  scraped_at: string;
  created_at: string;
  updated_at: string;
}

export const useProducts = () => {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name");

      if (error) throw error;
      return data as Product[];
    },
  });
};

export const useProduct = (slug: string | undefined) => {
  return useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      if (!slug) return null;

      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("slug", slug)
        .single();

      if (error) throw error;
      return data as Product;
    },
    enabled: !!slug,
  });
};

export const useProductVariants = (productId: string | undefined) => {
  return useQuery({
    queryKey: ["product-variants", productId],
    queryFn: async () => {
      if (!productId) return [];

      const { data, error } = await supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", productId)
        .order("storage_gb");

      if (error) throw error;
      return data as ProductVariant[];
    },
    enabled: !!productId,
  });
};

export const useVariantListings = (variantId: string | undefined) => {
  return useQuery({
    queryKey: ["variant-listings", variantId],
    queryFn: async () => {
      if (!variantId) return [];

      const { data, error } = await supabase
        .from("merchant_listings")
        .select("*")
        .eq("variant_id", variantId)
        .eq("is_valid", true) // Only fetch valid listings
        .order("price");

      if (error) throw error;
      return data as MerchantListing[];
    },
    enabled: !!variantId,
  });
};