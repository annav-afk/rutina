import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  try {
    const { userId, email, plan = "monthly", returnUrl } = await req.json();

    if (!userId || !email) {
      return new Response(JSON.stringify({ success: false, error: "Missing userId or email" }), {
        status: 400, headers: CORS,
      });
    }

    const shopId = Deno.env.get("YOOKASSA_SHOP_ID");
    const secretKey = Deno.env.get("YOOKASSA_SECRET_KEY");

    if (!shopId || !secretKey) {
      console.error("YooKassa credentials not configured");
      return new Response(JSON.stringify({ success: false, error: "Payment not configured" }), {
        status: 500, headers: CORS,
      });
    }

    // TEST MODE — 1.00 RUB
    const amount = "1.00";
    const description = plan === "yearly" ? "Рутина — подписка на 1 год" : "Рутина — подписка на 1 месяц";
    const finalReturnUrl = returnUrl ?? `${Deno.env.get("SITE_URL") ?? ""}/success`;

    const yooResponse = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotence-Key": crypto.randomUUID(),
        "Authorization": `Basic ${btoa(`${shopId}:${secretKey}`)}`,
      },
      body: JSON.stringify({
        amount: { value: amount, currency: "RUB" },
        confirmation: { type: "redirect", return_url: finalReturnUrl },
        capture: true,
        description,
        metadata: { user_id: userId, plan },
      }),
    });

    if (!yooResponse.ok) {
      const errText = await yooResponse.text();
      console.error("YooKassa error:", yooResponse.status, errText);
      return new Response(JSON.stringify({ success: false, error: "YooKassa error: " + errText }), {
        status: 500, headers: CORS,
      });
    }

    const payment = await yooResponse.json();

    return new Response(JSON.stringify({
      success: true,
      paymentId: payment.id,
      confirmationUrl: payment.confirmation.confirmation_url,
    }), { status: 200, headers: CORS });

  } catch (e) {
    console.error("create-payment-rutina error:", e);
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 500, headers: CORS,
    });
  }
});
