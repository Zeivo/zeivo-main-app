import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, priority_score, scrape_frequency_hours')

    if (productsError) throw productsError

    const updates = []

    for (const product of products) {
      const { data: listings, error: listingsError } = await supabase
        .from('merchant_listings')
        .select('confidence')
        .eq('product_id', product.id)
        .limit(100)

      if (listingsError) continue

      if (listings.length === 0) continue

      const avgConfidence = listings.reduce((sum, l) => sum + l.confidence, 0) / listings.length

      let newPriority = product.priority_score
      let newFrequency = product.scrape_frequency_hours

      if (avgConfidence < 0.7) {
        // Low confidence, increase priority and frequency
        newPriority = Math.min(100, product.priority_score + 10)
        newFrequency = Math.max(1, product.scrape_frequency_hours / 2)
      } else if (avgConfidence > 0.95) {
        // High confidence, decrease priority and frequency
        newPriority = Math.max(10, product.priority_score - 10)
        newFrequency = Math.min(168, product.scrape_frequency_hours * 1.5)
      }

      updates.push({
        id: product.id,
        priority_score: newPriority,
        scrape_frequency_hours: newFrequency,
      })
    }

    if (updates.length > 0) {
      const { error: updateError } = await supabase.from('products').upsert(updates)
      if (updateError) throw updateError
    }

    return new Response(JSON.stringify({ success: true, updates }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in update-product-priorities:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
