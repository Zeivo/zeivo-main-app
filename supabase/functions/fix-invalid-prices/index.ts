import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify admin access
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roles) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all smartphone listings with suspicious prices
    const { data: listings, error: fetchError } = await supabase
      .from('merchant_listings')
      .select(`
        id,
        price,
        variant_id,
        product_variants!inner(
          product_id,
          products!inner(
            category
          )
        )
      `)
      .eq('product_variants.products.category', 'smartphone');

    if (fetchError) {
      throw fetchError;
    }

    let updated = 0;
    let skipped = 0;

    // Update each listing based on price validation
    for (const listing of listings as any[]) {
      const shouldBeValid = listing.price >= 3000 && listing.price <= 30000;
      
      const { error: updateError } = await supabase
        .from('merchant_listings')
        .update({ is_valid: shouldBeValid })
        .eq('id', listing.id);

      if (updateError) {
        console.error(`Failed to update listing ${listing.id}:`, updateError);
        skipped++;
      } else {
        updated++;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Updated ${updated} listings, skipped ${skipped}`,
        total: listings?.length || 0
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Fix prices error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
