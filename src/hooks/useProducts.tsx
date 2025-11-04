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
        .select(`
          *,
          product_variants!inner(
            product_id,
            products!inner(
              category
            )
          )
        `)
        .eq("variant_id", variantId)
        .order("price");

      if (error) throw error;
      
      // Filter out invalid prices on the client side
      const filtered = (data as any[]).filter((listing) => {
        const category = listing.product_variants?.products?.category;
        
        // For smartphones, prices must be between 3000-30000 kr
        if (category === 'smartphone') {
          return listing.price >= 3000 && listing.price <= 30000;
        }
        
        return true;
      });
      
      return filtered as MerchantListing[];
    },
    enabled: !!variantId,
  });
};