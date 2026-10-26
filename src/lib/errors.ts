/**
 * The most useful sentence in an API error: the first field problem ("The selling price must be at
 * least 0.") or the server's message ("Duplicate barcode: 123"), else the fallback.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { message?: string; violations?: { message?: string }[] } } })?.response?.data;

  return data?.violations?.[0]?.message ?? data?.message ?? fallback;
}
