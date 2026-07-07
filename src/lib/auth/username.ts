/**
 * Username ↔ internal email mapping.
 *
 * Supabase Auth authenticates by email, but the app's UX is username-based.
 * Every username maps deterministically to an internal email under a fixed
 * domain, so users only ever type a username while Supabase still gets an
 * email. The SQL that seeds users must use the SAME rule (see setup script).
 *
 * Rule: lowercase, trim, spaces → dots, then "@build.store".
 *   "Dev"        -> "dev@build.store"
 *   "Ana Silva"  -> "ana.silva@build.store"
 */
export const AUTH_EMAIL_DOMAIN = "build.store";

export function usernameToEmail(username: string): string {
  const slug = username
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".");
  return `${slug}@${AUTH_EMAIL_DOMAIN}`;
}
