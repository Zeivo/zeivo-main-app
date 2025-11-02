import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PriceAlert {
  id: string;
  email: string;
  target_price: number;
  product_id: string;
  products: {
    name: string;
    slug: string;
  };
}

interface MerchantOffer {
  price: number;
  merchant_name: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("Checking active price alerts...");

    // Get all active price alerts
    const { data: alerts, error: alertsError } = await supabase
      .from("price_alerts")
      .select(`
        id,
        email,
        target_price,
        product_id,
        products (
          name,
          slug
        )
      `)
      .eq("is_active", true);

    if (alertsError) {
      console.error("Error fetching alerts:", alertsError);
      throw alertsError;
    }

    console.log(`Found ${alerts?.length || 0} active alerts`);

    if (!alerts || alerts.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active alerts to check" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const triggeredAlerts = [];

    // Check each alert
    for (const alert of alerts as PriceAlert[]) {
      console.log(`Checking alert ${alert.id} for product ${alert.product_id}`);

      // Get lowest price for this product
      const { data: offers, error: offersError } = await supabase
        .from("merchant_offers")
        .select("price, merchant_name")
        .eq("product_id", alert.product_id)
        .order("price", { ascending: true })
        .limit(1);

      if (offersError) {
        console.error(`Error fetching offers for product ${alert.product_id}:`, offersError);
        continue;
      }

      if (offers && offers.length > 0) {
        const lowestOffer = offers[0] as MerchantOffer;
        console.log(`Lowest price: ${lowestOffer.price}, Target: ${alert.target_price}`);

        // If price dropped below target, send email
        if (lowestOffer.price <= alert.target_price) {
          console.log(`Price alert triggered for ${alert.email}`);

          try {
            // Send email using fetch to Resend API
            const emailResponse = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: "Zeivo <onboarding@resend.dev>",
                to: [alert.email],
                subject: `🎉 Prisfallet! ${alert.products.name} er nå under ${alert.target_price} kr`,
                html: `
                  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #1a1a1a;">Prisfallet oppdaget!</h1>
                    <p style="font-size: 16px; color: #4a4a4a;">
                      God nyhet! Prisen på <strong>${alert.products.name}</strong> har falt til <strong>${lowestOffer.price} kr</strong> hos ${lowestOffer.merchant_name}.
                    </p>
                    <p style="font-size: 16px; color: #4a4a4a;">
                      Dette er under din målpris på ${alert.target_price} kr!
                    </p>
                    <a href="https://yfutdebllhsawqzihysx.lovable.app/produkt/${alert.products.slug}" 
                       style="display: inline-block; background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0;">
                      Se produktet
                    </a>
                    <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
                      Mvh,<br>
                      Zeivo-teamet
                    </p>
                  </div>
                `,
              }),
            });

            if (!emailResponse.ok) {
              throw new Error(`Resend API error: ${await emailResponse.text()}`);
            }

            const emailData = await emailResponse.json();
            console.log("Email sent successfully:", emailData);

            // Deactivate the alert
            await supabase
              .from("price_alerts")
              .update({ is_active: false })
              .eq("id", alert.id);

            triggeredAlerts.push({
              alert_id: alert.id,
              email: alert.email,
              product: alert.products.name,
            });
          } catch (emailError) {
            console.error("Error sending email:", emailError);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: "Price alerts checked successfully",
        triggered_count: triggeredAlerts.length,
        triggered_alerts: triggeredAlerts,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in check-price-alerts function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});