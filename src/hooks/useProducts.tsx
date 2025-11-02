import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Product {
  id: string;
  name: string;
  image: string;
  category: string;
  slug: string;
  new_price_low: number | null;
  new_price_high: number | null;
  used_price_low: number | null;
  used_price_high: number | null;
}

export interface MerchantOffer {
  id: string;
  merchant_name: string;
  price: number;
  url: string | null;
  condition: string;
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

export const useProductOffers = (productId: string | undefined) => {
  return useQuery({
    queryKey: ["product-offers", productId],
    queryFn: async () => {
      if (!productId) return [];

      const { data, error } = await supabase
        .from("merchant_offers")
        .select("*")
        .eq("product_id", productId)
        .order("price");

      if (error) throw error;
      return data as MerchantOffer[];
    },
    enabled: !!productId,
  });
};