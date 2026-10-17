import Stripe from "stripe";

function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key?.startsWith("sk_test_")) throw new Error("Stripe test key is missing");
  return new Stripe(key);
}

export function hold(jobId: string, taskId: string, amount: number) {
  return stripe().paymentIntents.create(
    {
      amount,
      currency: "usd",
      capture_method: "manual",
      payment_method: "pm_card_visa",
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      metadata: { jobId, taskId },
    },
    { idempotencyKey: `${jobId}:hold` },
  );
}

export function release(jobId: string, paymentIntentId: string) {
  return stripe().paymentIntents.cancel(paymentIntentId, {}, { idempotencyKey: `${jobId}:cancel` });
}
