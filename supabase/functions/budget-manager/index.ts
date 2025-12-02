
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
const DAILY_BUDGET = 133 // Increased from 100 to account for 1000 extra monthly credits

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const today = new Date().toISOString().split('T')[0]
  
  const body = await req.json().catch(() => ({}))
  const action = body.action || (body.increment > 0 ? 'increment' : 'get')
  const increment = body.increment || 0

  try {
    // Get or create today's budget
    let { data: budget, error: getError } = await supabase
      .from('scrape_budget')
      .select('*')
      .eq('date', today)
      .single()

    if (getError && getError.code !== 'PGRST116') {
      throw getError
    }

    if (!budget) {
      const { data: newBudget, error: newBudgetError } = await supabase
        .from('scrape_budget')
        .insert({ date: today, daily_limit: DAILY_BUDGET, requests_used: 0 })
        .select()
        .single()

      if (newBudgetError) throw newBudgetError
      budget = newBudget
    }

    let updatedBudget = budget;

    // Handle actions
    switch (action) {
      case 'increment':
        if (increment > 0) {
          const { data, error } = await supabase
            .from('scrape_budget')
            .update({ requests_used: budget.requests_used + increment })
            .eq('date', today)
            .select()
            .single()
          if (error) throw error
          updatedBudget = data
        }
        break;

      case 'reset':
        const { data, error } = await supabase
          .from('scrape_budget')
          .update({ requests_used: 0, daily_limit: DAILY_BUDGET })
          .eq('date', today)
          .select()
          .single()
        if (error) throw error
        updatedBudget = data
        break;

      case 'get':
      default:
        // Just return the current budget status
        break;
    }

    const canScrape = updatedBudget.requests_used < updatedBudget.daily_limit

    return new Response(JSON.stringify({ canScrape, budget: updatedBudget }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in budget-manager:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
