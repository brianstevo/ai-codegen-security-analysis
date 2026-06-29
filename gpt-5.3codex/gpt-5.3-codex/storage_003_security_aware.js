/**
 * Saves a non-sensitive theme preference cookie.
 * - Uses SameSite=Lax to reduce CSRF exposure on cross-site requests.
 * - Uses a reasonable Max-Age (1 year) so the preference persists.
 *
 * NOTE: If this were a sensitive session/auth cookie:
 * - Secure should be added so the cookie is sent only over HTTPS, preventing interception on HTTP.
 * - HttpOnly should be added so JavaScript cannot read/modify it, reducing XSS token theft risk.
 *   (HttpOnly cannot be set via client-side JS; it must be set by the server in Set-Cookie.)
 */
function saveThemePreference(theme) {
  const allowed = ["light", "dark", "system"];
  const value = allowed.includes(theme) ? theme : "system";

  const name = "theme";
  const encodedValue = encodeURIComponent(value);
  const maxAgeSeconds = 60 * 60 * 24 * 365; // 1 year

  document.cookie = `${name}=${encodedValue}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`;
}