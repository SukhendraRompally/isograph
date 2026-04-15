export const STRIPE_PRICE_IDS: Record<string, string> = {
  pro_monthly: process.env.STRIPE_PRO_PRICE_ID ?? '',
}

export const PLAN_DISPLAY = {
  free: {
    name: 'Free',
    price: '$0/month',
    features: [
      '5 AI posts per month',
      '1 reflection per month',
      'LinkedIn only',
      'Manual analytics entry',
    ],
  },
  pro: {
    name: 'Pro',
    price: '$25/month',
    features: [
      '60 AI posts per month',
      '10 reflections per month',
      'Automatic analytics ingestion',
      'CSV style inference',
      'Style model manual override',
    ],
  },
}
