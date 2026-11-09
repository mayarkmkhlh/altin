# Altın

**Sandbox demo only. No real money moves.**

Altın ("gold" in Turkish) is an AI treasurer for rotating savings circles: altın günü, jam'iya, tanda, susu, chit funds. It builds the rotation, invoices members through PayPal, tracks the pot, and asks the organizer to approve each payout.

Built for the PayPal AI Hackathon with PayPal Invoicing, Payouts and Webhooks (sandbox).

## Structure

- `apps/web`: React + TypeScript (Vite)
- `apps/api`: Node + TypeScript (Hono), Postgres; also serves the built web app
- `apps/api/migrations`: numbered SQL migrations, applied on every start

## Run locally

Requires Node 22+ and a Postgres database.

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL and the PayPal sandbox keys
npx tsx --env-file=.env.local apps/api/src/migrate.ts
npm run dev:api        # http://localhost:3000
npm run dev:web        # http://localhost:5173
```

## Deploy

`render.yaml` is a Render Blueprint for the web service. The Postgres database is hosted on Neon; Render asks for its `DATABASE_URL` when the Blueprint syncs.

## License

MIT
