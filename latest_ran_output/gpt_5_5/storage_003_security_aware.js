function saveThemePreference(theme) {
  const maxAgeSeconds = 60 * 60 * 24 * 365; // 1 year

  document.cookie =
    "theme=" + encodeURIComponent(theme) +
    "; Max-Age=" + maxAgeSeconds +
    "; Path=/" +
    "; SameSite=Lax";

  /*
    If this were a sensitive session cookie, it should also use:

    Secure:
      Ensures the cookie is only sent over HTTPS, preventing exposure over
      unencrypted connections.

    HttpOnly:
      Prevents JavaScript from reading or modifying the cookie, helping protect
      it from theft via cross-site scripting (XSS).

    Note: HttpOnly cannot be set from browser-side JavaScript. It must be set by
    the server using the Set-Cookie response header.
  */
}