import type { PayPalClient, WebhookSignatureHeaders } from "../engine/paypal-client";
import type { CircleStore } from "../store/circle-store";

export type WebhookDeps = {
  store: CircleStore;
  paypal: Pick<PayPalClient, "verifyWebhookSignature" | "getInvoiceStatus">;
  webhookId: string | undefined;
};

type WebhookEvent = { id?: string; event_type?: string; resource?: { id?: string; invoice?: { id?: string } } };

export type WebhookResult = { status: 200 | 400 | 500; body: string };

// Anything other than 2xx makes PayPal redeliver (up to 25 times over 3 days); the event id keeps that safe.
export async function handlePayPalWebhook(
  deps: WebhookDeps,
  request: { headers: Partial<WebhookSignatureHeaders>; rawBody: string },
): Promise<WebhookResult> {
  if (!deps.webhookId) return { status: 500, body: "PAYPAL_WEBHOOK_ID is not set" };

  let event: WebhookEvent;
  try {
    event = JSON.parse(request.rawBody) as WebhookEvent;
  } catch {
    return { status: 400, body: "invalid JSON" };
  }
  const { headers } = request;
  if (!event.id || !event.event_type) return { status: 400, body: "not a PayPal event" };
  if (!headers.authAlgo || !headers.certUrl || !headers.transmissionId || !headers.transmissionSig || !headers.transmissionTime) {
    return { status: 400, body: "missing signature headers" };
  }

  const verified = await deps.paypal.verifyWebhookSignature({
    webhookId: deps.webhookId,
    headers: headers as WebhookSignatureHeaders,
    rawBody: request.rawBody,
  });
  if (!verified) {
    console.log(`webhook: rejected unverified event ${event.id} (${event.event_type})`);
    return { status: 400, body: "signature verification failed" };
  }

  if (event.event_type !== "INVOICING.INVOICE.PAID") return { status: 200, body: "ignored" };

  const paypalInvoiceId = event.resource?.invoice?.id ?? event.resource?.id;
  if (!paypalInvoiceId) return { status: 200, body: "no invoice id" };

  // The webhook says paid; only PayPal's own GET makes it so.
  if ((await deps.paypal.getInvoiceStatus(paypalInvoiceId)) !== "paid") {
    return { status: 500, body: "invoice not paid yet" };
  }

  const result = await deps.store.recordInvoicePaid({ eventId: event.id, eventType: event.event_type, paypalInvoiceId });
  console.log(`webhook: ${event.id} ${paypalInvoiceId} -> ${result.kind}`);
  return { status: 200, body: result.kind };
}
