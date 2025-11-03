import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AIJob {
  id: string;
  kind: string;
  payload: any;
  cache_key?: string;
}

interface NormalizeOfferPayload {
  merchant_title: string;
  merchant_name: string;
  price: number;
  url?: string;
  candidates: Array<{ product_id: string; name: string }>;
}

interface ExtractAttributesPayload {
  product_id: string;
  text: string;
}

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const MAX_RETRIES = 3;

async function callGemini(prompt: string, systemPrompt: string): Promise<any> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: systemPrompt },
            { text: prompt }
          ]
        }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json"
        }
      })
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('Gemini API error:', error);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!text) {
    throw new Error('No response from Gemini');
  }

  return JSON.parse(text);
}

async function normalizeOffer(payload: NormalizeOfferPayload): Promise<any> {
  const systemPrompt = 'Return only valid JSON with structure: { "match": "product_id_or_no_match", "confidence": 0.0-1.0, "reason": "brief explanation" }. Use "no_match" if unsure.';
  
  const prompt = JSON.stringify({
    merchant_title: payload.merchant_title,
    merchant_name: payload.merchant_name,
    price: payload.price,
    candidates: payload.candidates
  });

  return await callGemini(prompt, systemPrompt);
}

async function extractAttributes(payload: ExtractAttributesPayload): Promise<any> {
  const systemPrompt = 'Extract product attributes from the text. Return JSON: { "attributes": [{"key": "storage", "value": "128GB"}, ...] }. Common keys: storage, color, model, generation.';
  
  const prompt = `Product text: ${payload.text}`;

  return await callGemini(prompt, systemPrompt);
}

async function writeAlertEmail(payload: any): Promise<any> {
  const systemPrompt = 'Write a short Norwegian price alert email (2-3 sentences). Return JSON: { "subject": "...", "body": "..." }';
  
  const prompt = JSON.stringify(payload);

  return await callGemini(prompt, systemPrompt);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch pending jobs (limit to avoid timeout)
    const { data: jobs, error: fetchError } = await supabase
      .from('ai_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10);

    if (fetchError) {
      throw fetchError;
    }

    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending jobs', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let processed = 0;
    const results = [];

    for (const job of jobs as AIJob[]) {
      try {
        // Mark as processing
        await supabase
          .from('ai_jobs')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('id', job.id);

        // Check cache first
        if (job.cache_key) {
          const { data: cached } = await supabase
            .from('ai_cache')
            .select('result')
            .eq('cache_key', job.cache_key)
            .gt('expires_at', new Date().toISOString())
            .single();

          if (cached) {
            console.log(`Cache hit for job ${job.id}`);
            
            // Store result and mark complete
            await storeResult(supabase, job, cached.result);
            
            await supabase
              .from('ai_jobs')
              .update({ 
                status: 'completed', 
                processed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', job.id);

            processed++;
            results.push({ job_id: job.id, cached: true });
            continue;
          }
        }

        // Process based on job kind
        let result;
        switch (job.kind) {
          case 'normalize_offer':
            result = await normalizeOffer(job.payload);
            break;
          case 'extract_attributes':
            result = await extractAttributes(job.payload);
            break;
          case 'write_alert_email':
            result = await writeAlertEmail(job.payload);
            break;
          default:
            throw new Error(`Unknown job kind: ${job.kind}`);
        }

        // Store in cache
        if (job.cache_key) {
          await supabase
            .from('ai_cache')
            .upsert({
              cache_key: job.cache_key,
              result: result,
              created_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
            });
        }

        // Store result
        await storeResult(supabase, job, result);

        // Mark as completed
        await supabase
          .from('ai_jobs')
          .update({ 
            status: 'completed', 
            processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);

        processed++;
        results.push({ job_id: job.id, kind: job.kind, cached: false });

      } catch (error) {
        console.error(`Error processing job ${job.id}:`, error);
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Mark as failed
        await supabase
          .from('ai_jobs')
          .update({ 
            status: 'failed', 
            error: errorMessage,
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);

        results.push({ job_id: job.id, error: errorMessage });
      }
    }

    return new Response(
      JSON.stringify({ 
        message: `Processed ${processed} jobs`,
        processed,
        total: jobs.length,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Worker error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function storeResult(supabase: any, job: AIJob, result: any) {
  if (job.kind === 'normalize_offer' && result.match !== 'no_match') {
    // Store normalized offer
    await supabase
      .from('normalized_offers')
      .insert({
        merchant_offer_id: job.payload.merchant_offer_id,
        normalized_product_id: result.match,
        confidence: result.confidence,
        reason: result.reason
      });
  } else if (job.kind === 'extract_attributes' && result.attributes) {
    // Store attributes
    const attributeInserts = result.attributes.map((attr: any) => ({
      product_id: job.payload.product_id,
      attribute_key: attr.key,
      attribute_value: attr.value,
      source: 'ai'
    }));
    
    await supabase
      .from('product_attributes')
      .insert(attributeInserts);
  }
}
