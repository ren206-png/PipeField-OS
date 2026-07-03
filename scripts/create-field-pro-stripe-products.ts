#!/usr/bin/env npx ts-node --esm
// ============================================================
// scripts/create-field-pro-stripe-products.ts
//
// One-time script: creates the Field Pro product + monthly price
// in Stripe and logs the resulting price IDs to console.
//
// Usage:
//   STRIPE_SECRET_KEY=sk_test_... npx ts-node --esm scripts/create-field-pro-stripe-products.ts
//
// After running:
//   1. Copy the price IDs logged below
//   2. Add them to your .env.local (dev) and Vercel project settings (prod):
//        STRIPE_PRICE_FIELD_PRO_MONTHLY=price_...
//   3. Do NOT commit price IDs to git — they belong in environment variables only.
//
// NOTE: Annual billing does not exist in this codebase.
//   TODO: When annual billing is implemented, add a yearly price here:
//     stripe.prices.create({ unit_amount: 9900, currency: 'usd',
//       recurring: { interval: 'year' }, product: product.id })
//   and expose it via STRIPE_PRICE_FIELD_PRO_ANNUAL.
// ============================================================

import Stripe from 'stripe'

const key = process.env.STRIPE_SECRET_KEY
if (!key) {
  console.error('\n❌  STRIPE_SECRET_KEY is not set.')
  console.error('    Run: STRIPE_SECRET_KEY=sk_test_... npx ts-node --esm scripts/create-field-pro-stripe-products.ts\n')
  process.exit(1)
}

const stripe = new Stripe(key)

async function main() {
  console.log('\n▶  Creating Field Pro product and price in Stripe…\n')

  // ── Product ────────────────────────────────────────────────
  const product = await stripe.products.create({
    name:        'PipeField OS — Field Pro',
    description: 'For individual pipefitters and field workers. Includes offset & take-off calculators, mobile access, daily log (PDF + CSV export), and personal project history. 1 user, no seat sharing.',
    metadata: {
      plan_key:  'field_pro',
      seat_limit: '1',
    },
  })
  console.log(`✅  Product created: ${product.id}  (${product.name})`)

  // ── Monthly price ($9.00 / month) ─────────────────────────
  const monthlyPrice = await stripe.prices.create({
    product:    product.id,
    currency:   'usd',
    unit_amount: 900,   // $9.00 in cents
    recurring: { interval: 'month' },
    metadata: { plan_key: 'field_pro', billing_interval: 'monthly' },
  })
  console.log(`✅  Monthly price created: ${monthlyPrice.id}  ($${monthlyPrice.unit_amount! / 100}/month)`)

  // ── TODO: Annual price ($99.00 / year) ────────────────────
  // Annual billing is not yet implemented in this codebase.
  // When added, uncomment and run this script again:
  //
  // const annualPrice = await stripe.prices.create({
  //   product:    product.id,
  //   currency:   'usd',
  //   unit_amount: 9900,  // $99.00 in cents
  //   recurring: { interval: 'year' },
  //   metadata: { plan_key: 'field_pro', billing_interval: 'annual' },
  // })
  // console.log(`✅  Annual price created: ${annualPrice.id}  ($${annualPrice.unit_amount! / 100}/year)`)

  // ── Output ─────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Add these to your environment variables:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  STRIPE_PRICE_FIELD_PRO_MONTHLY=${monthlyPrice.id}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('\n  ⚠️  Add these values to production secrets BEFORE deploying Field Pro.')
  console.log('     .env.local for dev, Vercel project settings for prod.\n')
}

main().catch(err => {
  console.error('\n❌  Script failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
