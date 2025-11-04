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

    // Test Vertex AI
    const VERTEX_AI_API_KEY = Deno.env.get('VERTEX_AI_API_KEY');
    if (!VERTEX_AI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'VERTEX_AI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Testing Vertex AI with API key:', VERTEX_AI_API_KEY.substring(0, 10) + '...');

    const testPrompt = 'Extract product information from this text: iPhone 15 128GB Blue';
    const systemPrompt = 'Extract product attributes. Return JSON: { "storage": "...", "color": "..." }';

    const response = await fetch(
      'https://api.vertexai.google.com/v1/chat/completions',
      {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${VERTEX_AI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gemini-2.0-flash-exp',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: testPrompt }
          ],
          temperature: 0,
          response_format: { type: "json_object" }
        })
      }
    );

    const responseText = await response.text();
    console.log('Vertex AI response status:', response.status);
    console.log('Vertex AI response body:', responseText);

    if (!response.ok) {
      return new Response(
        JSON.stringify({ 
          error: 'Vertex AI API error',
          status: response.status,
          details: responseText
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const data = JSON.parse(responseText);
    const aiResponse = data.choices?.[0]?.message?.content;

    return new Response(
      JSON.stringify({ 
        success: true,
        test_prompt: testPrompt,
        vertex_ai_response: aiResponse,
        parsed: aiResponse ? JSON.parse(aiResponse) : null,
        raw_response: data
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Test error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
