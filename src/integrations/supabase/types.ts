export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          result: Json
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at?: string
          result: Json
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          result?: Json
        }
        Relationships: []
      }
      ai_jobs: {
        Row: {
          cache_key: string | null
          created_at: string
          error: string | null
          id: string
          kind: string
          payload: Json
          processed_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          cache_key?: string | null
          created_at?: string
          error?: string | null
          id?: string
          kind: string
          payload: Json
          processed_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          cache_key?: string | null
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          payload?: Json
          processed_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      merchant_listings: {
        Row: {
          condition: string
          confidence: number | null
          created_at: string
          id: string
          is_valid: boolean | null
          listing_count: number | null
          listing_group_id: string | null
          market_insight: string | null
          merchant_name: string
          price: number
          price_max: number | null
          price_min: number | null
          price_tier: string | null
          scraped_at: string
          updated_at: string
          url: string | null
          variant_id: string
        }
        Insert: {
          condition: string
          confidence?: number | null
          created_at?: string
          id?: string
          is_valid?: boolean | null
          listing_count?: number | null
          listing_group_id?: string | null
          market_insight?: string | null
          merchant_name: string
          price: number
          price_max?: number | null
          price_min?: number | null
          price_tier?: string | null
          scraped_at?: string
          updated_at?: string
          url?: string | null
          variant_id: string
        }
        Update: {
          condition?: string
          confidence?: number | null
          created_at?: string
          id?: string
          is_valid?: boolean | null
          listing_count?: number | null
          listing_group_id?: string | null
          market_insight?: string | null
          merchant_name?: string
          price?: number
          price_max?: number | null
          price_min?: number | null
          price_tier?: string | null
          scraped_at?: string
          updated_at?: string
          url?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_listings_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_urls: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          last_scraped_at: string | null
          merchant_name: string
          product_id: string
          updated_at: string
          url: string
          url_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_scraped_at?: string | null
          merchant_name: string
          product_id: string
          updated_at?: string
          url: string
          url_type: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_scraped_at?: string | null
          merchant_name?: string
          product_id?: string
          updated_at?: string
          url?: string
          url_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_urls_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          region: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          region?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          region?: string
          updated_at?: string
        }
        Relationships: []
      }
      price_history: {
        Row: {
          condition: string
          id: string
          merchant_name: string
          price: number
          product_id: string | null
          scraped_at: string
        }
        Insert: {
          condition: string
          id?: string
          merchant_name: string
          price: number
          product_id?: string | null
          scraped_at?: string
        }
        Update: {
          condition?: string
          id?: string
          merchant_name?: string
          price?: number
          product_id?: string | null
          scraped_at?: string
        }
        Relationships: []
      }
      product_variants: {
        Row: {
          availability: string | null
          color: string | null
          confidence: number | null
          created_at: string
          ean: string | null
          id: string
          image_url: string | null
          model: string | null
          mpn: string | null
          price_data: Json | null
          price_new: number | null
          price_used: number | null
          product_id: string
          sku: string | null
          storage_gb: number | null
          updated_at: string
        }
        Insert: {
          availability?: string | null
          color?: string | null
          confidence?: number | null
          created_at?: string
          ean?: string | null
          id?: string
          image_url?: string | null
          model?: string | null
          mpn?: string | null
          price_data?: Json | null
          price_new?: number | null
          price_used?: number | null
          product_id: string
          sku?: string | null
          storage_gb?: number | null
          updated_at?: string
        }
        Update: {
          availability?: string | null
          color?: string | null
          confidence?: number | null
          created_at?: string
          ean?: string | null
          id?: string
          image_url?: string | null
          model?: string | null
          mpn?: string | null
          price_data?: Json | null
          price_new?: number | null
          price_used?: number | null
          product_id?: string
          sku?: string | null
          storage_gb?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string | null
          category: string
          created_at: string
          family: string | null
          id: string
          image: string | null
          last_scraped_at: string | null
          model: string | null
          name: string
          priority_score: number | null
          scrape_frequency_hours: number | null
          slug: string
          updated_at: string
        }
        Insert: {
          brand?: string | null
          category: string
          created_at?: string
          family?: string | null
          id?: string
          image?: string | null
          last_scraped_at?: string | null
          model?: string | null
          name: string
          priority_score?: number | null
          scrape_frequency_hours?: number | null
          slug: string
          updated_at?: string
        }
        Update: {
          brand?: string | null
          category?: string
          created_at?: string
          family?: string | null
          id?: string
          image?: string | null
          last_scraped_at?: string | null
          model?: string | null
          name?: string
          priority_score?: number | null
          scrape_frequency_hours?: number | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      scrape_budget: {
        Row: {
          budget_remaining: number
          budget_total: number
          budget_used: number
          created_at: string
          date: string
          id: string
          updated_at: string
        }
        Insert: {
          budget_remaining?: number
          budget_total?: number
          budget_used?: number
          created_at?: string
          date: string
          id?: string
          updated_at?: string
        }
        Update: {
          budget_remaining?: number
          budget_total?: number
          budget_used?: number
          created_at?: string
          date?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
