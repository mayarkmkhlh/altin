# Decisions

## Spike 1: invoices (t044, t091)
- An invoice moves DRAFT → SENT → PAID; only a GET that says PAID counts as paid.
- The 403 on first create was a missing Invoicing feature on the app, found by reading the token's `scope`.
- Saudi sandbox accounts can invoice and pay in USD; no US accounts needed.
- The sandbox pay page can hang after paying; trust the API status, not the browser.
- Each run fetches a fresh token; client credentials have no refresh step.

## Spike 2: payouts (t045)
- Payouts are async: PENDING → PROCESSING → SUCCESS in about 30 seconds, so the UI polls and shows progress.
- `sender_batch_id` is built from circle + month + recipient; PayPal rejects a repeat, so a double click can't pay twice.
- Check the recipient's item status as well as the batch status (an item can be UNCLAIMED).
- Payouts was already enabled on the sandbox app; no extra setup.
- Polling has a limit so a stuck batch can't hang the request.

## Spike 3: webhooks on Render (t046)
- PayPal pushes INVOICING.INVOICE.PAID about 14 seconds after payment; no polling fallback needed for the demo.
- Every webhook is checked with PayPal's verify endpoint; unsigned or forged requests get a 400.
- Repeat deliveries are ignored by event id (in Postgres in the real app, not memory).
- The handler answers 200 first, then confirms the invoice with a GET.
- Free Render instances sleep; wake the app before filming.

## Scaffold (t048)
- One Render service serves both the API and the built React app: one URL, no CORS.
- Postgres is on Neon (free, no expiry) because Render's single free database slot is used by Sijil.
- Migrations are numbered SQL files applied on every start and recorded in `schema_migrations`.
- Money is integer US cents everywhere; SAR is a display label at 3.75.
- The database enforces the rules too: one invoice per member per gathering, fixed status lists, USD only.

## Circle engine (t049)
- No fixed contribution: each invoice is that member's own pledge, and the payout is the sum of paid invoices.
- A pot is complete when every invoice is paid or closed and at least one is paid; partial payment blocks it.
- `releasing` sits between approval and PayPal's SUCCESS, because payouts take about 30 seconds.
- The payback suggestion is what the host gave at the giver's own gathering; it is only a default and stays editable.
- The engine is pure functions with no database or network, so every state change is tested in milliseconds.

## The agent (t050)
- Three tools only (council cap): create_circle, send_member_invoices, propose_payout. Swapping turns waits.
- The agent's PayPal access is createInvoice and sendInvoice only; payouts aren't reachable from any tool.
- The model passes amounts as said ("1000", SAR); code converts to USD cents, so the model never does money arithmetic.
- Tool inputs are Zod schemas, so a bad call (one member, negative amount) is rejected before any code runs.
- Muse Spark through the Vercel AI SDK's OpenAI-compatible provider, with the same env names as Sijil.

## Approval gate and audit log (t051)
- One Approve call per payout (council cut): no batching and no retry button. A PayPal error is logged and left for a person.
- Approving flips the pending row with a conditional update, so two taps at once still make one payout call.
- Before paying, the server recomputes the payout from the current invoices and refuses if it differs from the proposal.
- A gathering is released only when a GET says the batch is SUCCESS; the item-level UNCLAIMED check is still to do.
- Every agent action, failed tool call, PayPal call and approval is an audit row, shown newest first on the circle page.

## React UI (t052)
- Four tabs (Circle, Assistant, Approvals, Activity) on one circle; no circle list (council cap: one circle screen).
- Sijil-style layout: shared components in components/, one folder per feature in modules/, hooks, and all EN/AR text in one copy file.
- Plain CSS with logical properties, so Arabic RTL comes from dir on <html>; chat bubbles use dir="auto" for mixed text.
- One read endpoint (GET /api/circles/:id) returns the whole board; the page polls only while a payout is confirming.
- The approval card shows the payout and who gave what; the Approve button is the only path to Payouts.
- No auth yet: the circle id in the URL is the key. Receiver emails are masked in the view.
