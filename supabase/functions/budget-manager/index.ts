import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { action, amount } = await req.json();
    const today = new Date().toISOString().split('T')[0];

    if (action === 'get') {
      // Get current budget status
      const { data: budget } = await supabase
        .from('scrape_budget')
        .select('*')
        .eq('date', today)
        .single();

      if (!budget) {
        // Create today's budget
        const { data: newBudget, error } = await supabase
          .from('scrape_budget')
          .insert({
            date: today,
            budget_total: 100,
            budget_used: 0,
            budget_remaining: 100
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ 
            success: true,
            budget: newBudget
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          budget
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'allocate') {
      // Allocate budget for a scraping request
      const { data: budget } = await supabase
        .from('scrape_budget')
        .select('*')
        .eq('date', today)
        .single();

      if (!budget) {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'No budget found for today'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      if (budget.budget_remaining < amount) {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Insufficient budget',
            remaining: budget.budget_remaining
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
        );
      }

      // Update budget
      const { error } = await supabase
        .from('scrape_budget')
        .update({
          budget_used: budget.budget_used + amount,
          budget_remaining: budget.budget_remaining - amount
        })
        .eq('date', today);

      if (error) throw error;

      return new Response(
        JSON.stringify({ 
          success: true,
          allocated: amount,
          remaining: budget.budget_remaining - amount
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'reset') {
      // Reset budget (admin only)
      const { error } = await supabase
        .from('scrape_budget')
        .upsert({
          date: today,
          budget_total: 100,
          budget_used: 0,
          budget_remaining: 100
        });

      if (error) throw error;

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Budget reset successfully'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        error: 'Invalid action. Use: get, allocate, or reset' 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in budget-manager:', error);
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
