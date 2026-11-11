const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 1)}•••@${domain}`;
}

export function redactEmails(text: string): string {
  return text.replace(EMAIL, maskEmail);
}

// Audit details are shown to anyone holding the circle link, so every email in them is masked on the way out.
export function redactDetails(details: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(details).map(([key, value]) => [key, typeof value === "string" ? redactEmails(value) : value]),
  );
}

// Error objects can carry the whole request (the AI SDK keeps the prompt, PayPal echoes the receiver),
// so logs get the error's name and a masked, shortened message only.
export function logError(where: string, err: unknown): void {
  const name = err instanceof Error ? err.name : "Error";
  const message = err instanceof Error ? err.message : String(err);
  console.error(`${where}: ${name}: ${redactEmails(message).slice(0, 300)}`);
}
