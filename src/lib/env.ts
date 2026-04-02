/**
 * Type-safe environment variable access.
 * Throws at runtime if a required variable is missing.
 */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const env = {
  apiUrl: requireEnv("NEXT_PUBLIC_API_URL"),
} as const;
