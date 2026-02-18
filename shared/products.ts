/**
 * Stripe Products & Pricing Configuration
 * 
 * Credit System Pricing:
 * - Base LLM cost markup: 700%
 * - Subscription markups: 1500% ($10) → 300% ($1000)
 * - Annual discount: 30% (pay for 10 months, get 12)
 * 
 * Free Tier:
 * - 5 initial searches
 * - 1 search per month thereafter
 */

// Estimated LLM costs per feature (in USD)
export const LLM_COSTS = {
  hts_search: 0.005,      // ~$0.005 per search
  tariff_calc: 0.008,     // ~$0.008 per calculation
  regulations: 0.010,     // ~$0.010 per country lookup
  checklist: 0.012,       // ~$0.012 per checklist generation
  chat_message: 0.003,    // ~$0.003 per message
} as const;

// Base markup for all features (700%)
export const BASE_MARKUP = 7.0;

// Calculate credit cost for a feature
export function calculateCreditCost(featureName: keyof typeof LLM_COSTS): number {
  const llmCost = LLM_COSTS[featureName];
  return llmCost * (1 + BASE_MARKUP); // 700% markup = 8x cost
}

// Credit packages with tiered pricing
export const CREDIT_PACKAGES = [
  {
    tier: "$10",
    monthlyPrice: 10.00,
    annualPrice: 84.00, // 30% discount
    markupRate: 15.0, // 1500%
    creditsMonthly: 125,   // $10 / ($0.005 * 16) = 125 searches worth
    creditsAnnual: 1500,   // 12 months worth
    stripePriceIdMonthly: process.env.STRIPE_PRICE_10_MONTHLY || "",
    stripePriceIdAnnual: process.env.STRIPE_PRICE_10_ANNUAL || "",
  },
  {
    tier: "$20",
    monthlyPrice: 20.00,
    annualPrice: 168.00,
    markupRate: 12.0, // 1200%
    creditsMonthly: 308,   // Better rate
    creditsAnnual: 3696,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_20_MONTHLY || "",
    stripePriceIdAnnual: process.env.STRIPE_PRICE_20_ANNUAL || "",
  },
  {
    tier: "$50",
    monthlyPrice: 50.00,
    annualPrice: 420.00,
    markupRate: 9.0, // 900%
    creditsMonthly: 1000,
    creditsAnnual: 12000,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_50_MONTHLY || "",
    stripePriceIdAnnual: process.env.STRIPE_PRICE_50_ANNUAL || "",
  },
  {
    tier: "$100",
    monthlyPrice: 100.00,
    annualPrice: 840.00,
    markupRate: 6.0, // 600%
    creditsMonthly: 2857,
    creditsAnnual: 34284,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_100_MONTHLY || "",
    stripePriceIdAnnual: process.env.STRIPE_PRICE_100_ANNUAL || "",
  },
  {
    tier: "$500",
    monthlyPrice: 500.00,
    annualPrice: 4200.00,
    markupRate: 4.5, // 450%
    creditsMonthly: 18182,
    creditsAnnual: 218184,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_500_MONTHLY || "",
    stripePriceIdAnnual: process.env.STRIPE_PRICE_500_ANNUAL || "",
  },
  {
    tier: "$1000",
    monthlyPrice: 1000.00,
    annualPrice: 8400.00,
    markupRate: 3.0, // 300%
    creditsMonthly: 50000,
    creditsAnnual: 600000,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_1000_MONTHLY || "",
    stripePriceIdAnnual: process.env.STRIPE_PRICE_1000_ANNUAL || "",
  },
] as const;

// Free tier limits
export const FREE_TIER = {
  initialSearches: 5,
  monthlySearches: 1,
} as const;

// Helper to get package by tier
export function getPackageByTier(tier: string) {
  return CREDIT_PACKAGES.find(p => p.tier === tier);
}

// Helper to get package by Stripe price ID
export function getPackageByPriceId(priceId: string) {
  return CREDIT_PACKAGES.find(
    p => p.stripePriceIdMonthly === priceId || p.stripePriceIdAnnual === priceId
  );
}

// Helper to determine if price ID is annual
export function isAnnualPrice(priceId: string): boolean {
  return CREDIT_PACKAGES.some(p => p.stripePriceIdAnnual === priceId);
}
