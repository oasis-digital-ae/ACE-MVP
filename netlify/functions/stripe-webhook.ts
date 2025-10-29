import type { Handler } from '@netlify/functions';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const config = {
  // Ensure Netlify passes the raw body so we can verify signature
  // parse: false is used in older runtimes; new runtimes expose raw body string as event.body
} as any;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export const handler: Handler = async (event) => {
  try {
    const signature = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
    if (!signature) return { statusCode: 400, body: 'Missing signature' };

    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET as string;
    const rawBody = event.body as string;

    let stripeEvent: Stripe.Event;
    try {
      stripeEvent = stripe.webhooks.constructEvent(rawBody, String(signature), endpointSecret);
    } catch (err: any) {
      return { statusCode: 400, body: `Webhook Error: ${err.message}` };
    }

    // Idempotency guard
    const { data: existing } = await supabase
      .from('stripe_events')
      .select('id')
      .eq('id', stripeEvent.id)
      .maybeSingle();

    if (!existing) {
      await supabase.from('stripe_events').insert({ id: stripeEvent.id, type: stripeEvent.type });

      if (stripeEvent.type === 'payment_intent.succeeded') {
        const pi = stripeEvent.data.object as Stripe.PaymentIntent;
        const userId = pi.metadata?.user_id;
        const amount = pi.amount_received || pi.amount || 0;

        if (userId && amount > 0) {
          await supabase.rpc('credit_wallet', {
            p_user_id: userId,
            p_amount_cents: amount,
            p_ref: pi.id,
          });
        }
      }
    }

    return { statusCode: 200, body: 'ok' };
  } catch (e: any) {
    return { statusCode: 500, body: e?.message || 'webhook error' };
  }
};


