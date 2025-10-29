import type { Handler } from '@netlify/functions';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  try {
    const { amount_cents, user_id, currency } = JSON.parse(event.body || '{}');

    if (!amount_cents || !user_id) {
      return { statusCode: 400, body: 'amount_cents and user_id are required' };
    }

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: Number(amount_cents),
        currency: (currency || 'usd').toLowerCase(),
        metadata: { user_id: String(user_id), purpose: 'wallet_top_up' },
        automatic_payment_methods: { enabled: true },
      },
      { idempotencyKey: `pi_topup_${user_id}_${amount_cents}` }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ clientSecret: paymentIntent.client_secret }),
    };
  } catch (err: any) {
    return { statusCode: 500, body: err?.message || 'Server error' };
  }
};


