import type { InvoiceStatus } from "./circle";
import { centsToUsdString } from "./money";

export type PayPalConfig = {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  fetch?: typeof fetch;
  now?: () => number;
};

export type WebhookSignatureHeaders = {
  authAlgo: string;
  certUrl: string;
  transmissionId: string;
  transmissionSig: string;
  transmissionTime: string;
};

// Refresh a minute early so a token never expires in the middle of a request.
const TOKEN_REFRESH_MARGIN_MS = 60_000;

export class PayPalClient {
  private token?: { value: string; expiresAt: number };
  private readonly fetch: typeof fetch;
  private readonly now: () => number;

  constructor(private readonly config: PayPalConfig) {
    this.fetch = config.fetch ?? globalThis.fetch;
    this.now = config.now ?? Date.now;
  }

  static fromEnv(): PayPalClient {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error("PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is missing");
    return new PayPalClient({ baseUrl: "https://api-m.sandbox.paypal.com", clientId, clientSecret });
  }

  async createInvoice(input: {
    requestId: string;
    recipientEmail: string;
    amountCents: number;
    itemName: string;
    note?: string;
  }): Promise<string> {
    const invoice = await this.request<{ id: string }>(
      "POST",
      "/v2/invoicing/invoices",
      {
        detail: { currency_code: "USD", note: input.note },
        primary_recipients: [{ billing_info: { email_address: input.recipientEmail } }],
        items: [
          {
            name: input.itemName,
            quantity: "1",
            unit_amount: { currency_code: "USD", value: centsToUsdString(input.amountCents) },
          },
        ],
      },
      { "PayPal-Request-Id": input.requestId, Prefer: "return=representation" },
    );
    return invoice.id;
  }

  async sendInvoice(invoiceId: string): Promise<void> {
    await this.request("POST", `/v2/invoicing/invoices/${invoiceId}/send`, {
      send_to_invoicer: false,
      send_to_recipient: true,
    });
  }

  async remindInvoice(invoiceId: string, message: { subject: string; note: string }): Promise<void> {
    await this.request("POST", `/v2/invoicing/invoices/${invoiceId}/remind`, {
      ...message,
      send_to_invoicer: false,
      send_to_recipient: true,
    });
  }

  async cancelInvoice(invoiceId: string, note: string): Promise<void> {
    await this.request("POST", `/v2/invoicing/invoices/${invoiceId}/cancel`, {
      note,
      send_to_invoicer: false,
      send_to_recipient: true,
    });
  }

  // Only PayPal's PAID counts as paid (business rule 4); anything unrecognised stays unpaid.
  async getInvoiceStatus(invoiceId: string): Promise<InvoiceStatus> {
    const invoice = await this.request<{ status: string }>("GET", `/v2/invoicing/invoices/${invoiceId}`);
    switch (invoice.status) {
      case "DRAFT":
        return "draft";
      case "PARTIALLY_PAID":
        return "partially_paid";
      case "PAID":
        return "paid";
      case "CANCELLED":
        return "closed";
      default:
        return "sent";
    }
  }

  async createPayout(input: {
    senderBatchId: string;
    receiverEmail: string;
    amountCents: number;
    note: string;
  }): Promise<string> {
    const batch = await this.request<{ batch_header: { payout_batch_id: string } }>(
      "POST",
      "/v1/payments/payouts",
      {
        sender_batch_header: {
          sender_batch_id: input.senderBatchId,
          email_subject: "Your Altın gathering pot",
          email_message: input.note,
        },
        items: [
          {
            recipient_type: "EMAIL",
            receiver: input.receiverEmail,
            amount: { value: centsToUsdString(input.amountCents), currency: "USD" },
            note: input.note,
            // PayPal caps this at 63 characters; the batch id already identifies the payout.
            sender_item_id: "pot",
          },
        ],
      },
    );
    return batch.batch_header.payout_batch_id;
  }

  async getPayoutStatus(batchId: string): Promise<string> {
    const batch = await this.request<{ batch_header: { batch_status: string } }>(
      "GET",
      `/v1/payments/payouts/${batchId}`,
    );
    return batch.batch_header.batch_status;
  }

  // PayPal checks the event byte for byte, so the raw body is spliced in rather than parsed and re-serialized.
  async verifyWebhookSignature(input: {
    webhookId: string;
    headers: WebhookSignatureHeaders;
    rawBody: string;
  }): Promise<boolean> {
    const { headers } = input;
    const fields = JSON.stringify({
      auth_algo: headers.authAlgo,
      cert_url: headers.certUrl,
      transmission_id: headers.transmissionId,
      transmission_sig: headers.transmissionSig,
      transmission_time: headers.transmissionTime,
      webhook_id: input.webhookId,
    });
    const body = `${fields.slice(0, -1)},"webhook_event":${input.rawBody}}`;
    const result = await this.send<{ verification_status: string }>("POST", "/v1/notifications/verify-webhook-signature", body);
    return result.verification_status === "SUCCESS";
  }

  private async getToken(): Promise<string> {
    const now = this.now();
    if (this.token && now < this.token.expiresAt) return this.token.value;

    const basic = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64");
    const res = await this.fetch(`${this.config.baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: { Authorization: `Basic ${basic}` },
      body: new URLSearchParams({ grant_type: "client_credentials" }),
    });
    if (!res.ok) throw new Error(`PayPal token request failed: ${res.status} ${await res.text()}`);

    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: data.access_token, expiresAt: now + data.expires_in * 1000 - TOKEN_REFRESH_MARGIN_MS };
    return this.token.value;
  }

  private request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<T> {
    return this.send<T>(method, path, body === undefined ? undefined : JSON.stringify(body), headers);
  }

  private async send<T>(method: string, path: string, body: string | undefined, headers: Record<string, string> = {}): Promise<T> {
    const res = await this.fetch(`${this.config.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${await this.getToken()}`,
        "Content-Type": "application/json",
        ...headers,
      },
      body,
    });
    if (!res.ok) throw new Error(`PayPal ${method} ${path} failed: ${res.status} ${await res.text()}`);

    const text = await res.text();
    return (text ? JSON.parse(text) : {}) as T;
  }
}
