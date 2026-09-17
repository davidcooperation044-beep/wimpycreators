# WimpyCreators

WimpyCreators is the creator discovery and monetization frontend for the Wimpy Cooperations ecosystem. It uses WimpyID for authentication, Supabase for shared data, and WimpyPay for all wallet charges and creator payouts.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Fill in the Supabase client values and server-only WimpyPay values.
3. Apply `supabase/migrations/001_wimpycreators.sql` to the shared Supabase project.
4. Create a public Supabase Storage bucket named `creator-assets` with upload policies appropriate for authenticated users.
5. Run `npm install` and `npm run dev`.

Never prefix server-only variables with `VITE_`. The browser only receives `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Integration boundaries

- `src/lib/supabase.ts` is the single browser Supabase client. It bootstraps WimpyID's `access_token` and `refresh_token` handoff and strips them from the URL.
- `api/tip.ts` and `api/subscribe.ts` call WimpyPay's internal wallet-charge endpoint, then write the successful result with the service-role client.
- `api/register-payout-recipient.ts`, `api/request-payout.ts`, and `api/payout-status.ts` are server-only payout boundaries.
- `supabase/functions/process-subscriptions/index.ts` is intended to run monthly from Supabase Cron. It retries active subscriptions due at the current time and marks failed charges `past_due`.
- The separate WimpyPay service must own Paystack transfer recipient registration, transfer webhooks, and its payout ledger. WimpyCreators only calls its internal endpoints.

## Search and safety

Creator filtering currently happens client-side as requested. Once the directory grows beyond a few hundred creators, move it to a Supabase `ilike` or full-text query. User text is rendered through React text nodes; no `innerHTML` path is used.
# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
