# Graider subscriptions (RevenueCat)

Freemium paper grading with a single **`pro`** entitlement across iOS (App Store IAP) and web (RevenueCat Billing via Stripe).

## Tiers & pricing

| Tier | Price | Limits |
|------|-------|--------|
| Free | $0 | 1 owned class, 3 tests graded / calendar month |
| Pro monthly | **$24.99 / month** | Unlimited classes + tests graded |
| Pro annual | **$239.99 / year** (~20% vs monthly) | Same as monthly |

Pre-auth onboarding sample grade is **not** gated.

Product identifiers (create in RevenueCat + stores):

- `graider_pro_monthly`
- `graider_pro_annual`

Entitlement identifier: **`pro`**

## RevenueCat dashboard setup

### Shared

1. Project with entitlement **`pro`**.
2. Webhook → `https://<your-host>/api/webhooks/revenuecat`  
   Authorization: `Bearer <REVENUECAT_WEBHOOK_AUTH>`
3. Use Clerk `userId` as RevenueCat `app_user_id` (mobile `Purchases.logIn`, web SDK `configure({ appUserId })`).

### iOS (App Store)

1. App Store products matching the identifiers above (or map store products → RC products).
2. Attach both products to entitlement `pro`.
3. Current offering with `$rc_monthly` and `$rc_annual` packages.

### Web (RevenueCat Billing)

1. Connect Stripe in RevenueCat account settings.
2. Create a **Web** / RevenueCat Billing config.
3. Create products:
   - `graider_pro_monthly` → **$24.99 USD / month**
   - `graider_pro_annual` → **$239.99 USD / year**
4. Attach both to entitlement `pro`.
5. Put both packages on the **current offering** (`$rc_monthly`, `$rc_annual`).
6. Copy the **Web Billing public API key** into Vercel as `NEXT_PUBLIC_REVENUECAT_WEB_API_KEY`.

## Environment variables

**Backend (Vercel):**

- `REVENUECAT_SECRET_API_KEY` — subscriber API
- `REVENUECAT_WEBHOOK_AUTH` — webhook bearer
- `NEXT_PUBLIC_REVENUECAT_WEB_API_KEY` — Web SDK (`purchases-js`)

**Mobile (EAS):**

- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` — iOS public SDK key (`appl_…`)

## Web app

| Path | Purpose |
|------|---------|
| `/t/billing` | Teacher billing: usage, monthly/annual checkout, manage portal |
| `GET /api/me/subscription` | Usage + plan catalog |
| `POST /api/me/subscription/sync` | Pull RC subscriber → `subscription_tier` |
| `POST /api/webhooks/revenuecat` | RC webhook → `subscription_tier` |

After a successful web purchase, the client calls `/api/me/subscription/sync` so Postgres matches RC immediately (webhook is the durable path).

## API limit codes

Grade-stack / class creation return **402** with `{ code: "GRADE_LIMIT" | "CLASS_LIMIT" }` when free limits are exceeded. Web class creation redirects teachers to `/t/billing`.
