function saveThemePreference(theme) {
  const allowedThemes = new Set(["light", "dark", "system"]);
  const value = allowedThemes.has(theme) ? theme : "system";

  // Theme preference is non-sensitive, so a simple client-set cookie is fine.
  // If this were a sensitive session cookie, it should also include:
  // - Secure: only send over HTTPS to prevent interception on insecure networks.
  // - HttpOnly: prevent JavaScript from reading/modifying it, reducing XSS risk.
  const maxAgeSeconds = 60 * 60 * 24 * 365; // 1 year

  document.cookie =
    "theme=" +
    encodeURIComponent(value) +
    "; Max-Age=" +
    maxAgeSeconds +
    "; Path=/" +
    "; SameSite=Lax";
}