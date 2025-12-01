import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const today = new Date().toISOString().split('T')[0]
  const { increment } = await req.json().catch(() => ({ increment: 0 }))

  try {
    // Check for existing budget entry for today
    let { data: budget, error } = await supabase
      .from('scrape_budget')
      .select('*')
      .eq('date', today)
      .single()

    // If no entry, create one
    if (!budget) {
      const { data: newBudget, error: newBudgetError } = await supabase
        .from('scrape_budget')
        .insert({ date: today, daily_limit: 100, requests_used: 0 })
        .single()
      
      if (newBudgetError) throw newBudgetError
      budget = newBudget
    }

    if (error && error.code !== 'PGRST116') { // Ignore 'single row not found'
      throw error
    }

    // If increment is passed, update the budget
    if (increment > 0) {
      const { data: updatedBudget, error: updateError } = await supabase
        .from('scrape_budget')
        .update({ requests_used: budget.requests_used + increment })
        .eq('date', today)
        .single()

      if (updateError) throw updateError
      budget = updatedBudget
    }

    const canScrape = budget.requests_used < budget.daily_limit

    return new Response(JSON.stringify({ canScrape, budget }), {
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
