/** First human-readable message from an API error response. */
export function firstError(data: { error?: string; fieldErrors?: Record<string, string[] | undefined> }) {
  for (const [field, messages] of Object.entries(data.fieldErrors ?? {})) {
    if (messages?.length) return `${field}: ${messages[0]}`;
  }
  return data.error;
}
