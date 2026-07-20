from flask import Flask, request, redirect, url_for, session
from urllib.parse import urlparse, urljoin

app = Flask(__name__)
app.secret_key = "replace-with-a-secure-random-secret"

# Explicit whitelist of trusted external domains (hostnames only).
TRUSTED_DOMAINS = {
    "example.com",
    "www.example.com",
    "app.example.com",
}

# Default safe landing page when returnTo is missing or invalid.
DEFAULT_REDIRECT = "/dashboard"


def is_safe_redirect_target(target):
    """
    Return True only if `target` is:
      - a relative path (no scheme, no netloc), OR
      - an absolute URL whose scheme is http/https AND whose hostname
        is in the trusted-domain whitelist.
    Everything else (including scheme-relative URLs like //evil.com,
    javascript:, data:, mailto:, etc.) is rejected.
    """
    if not target or not isinstance(target, str):
        return False

    # Strip surrounding whitespace and control characters that could be
    # used to smuggle payloads past the parser.
    target = target.strip()
    if not target:
        return False

    # Reject any target containing control chars or embedded newlines.
    if any(ord(c) < 0x20 or ord(c) == 0x7F for c in target):
        return False

    # Reject backslashes which some browsers treat as forward slashes.
    if "\\" in target:
        return False

    parsed = urlparse(target)

    # Reject scheme-relative URLs (e.g. "//evil.com/path").
    # urlparse gives an empty scheme but a populated netloc for these.
    if parsed.netloc and not parsed.scheme:
        return False

    # Case 1: purely relative path (no scheme, no netloc).
    if not parsed.scheme and not parsed.netloc:
        # Must start with a single leading slash to be a site-relative path.
        # Reject things like "javascript:..." which urlparse may treat oddly.
        if target.startswith("/") and not target.startswith("//"):
            return True
        return False

    # Case 2: absolute URL. Only allow http/https to trusted hostnames.
    if parsed.scheme in ("http", "https"):
        hostname = parsed.hostname
        if hostname and hostname.lower() in TRUSTED_DOMAINS:
            return True
        return False

    # Any other scheme (javascript:, data:, mailto:, ftp:, etc.) is rejected.
    return False


def get_safe_redirect(target):
    """Return a validated redirect target or the default."""
    if is_safe_redirect_target(target):
        return target
    return DEFAULT_REDIRECT


@app.route("/login", methods=["GET", "POST"])
def login():
    return_to = request.args.get("returnTo", "")

    if request.method == "POST":
        username = request.form.get("username", "")
        password = request.form.get("password", "")

        # Placeholder authentication check; replace with real verification.
        if authenticate(username, password):
            session["user"] = username
            # Prefer the form-supplied returnTo (carried through login form),
            # falling back to the query string.
            candidate = request.form.get("returnTo") or return_to
            destination = get_safe_redirect(candidate)
            return redirect(destination)

        # On failure, re-render login preserving the (unvalidated) returnTo
        # for the form; it is only validated at redirect time.
        return "Invalid credentials", 401

    # GET: render a login form. In a real app you'd embed returnTo in a
    # hidden field so it survives the POST.
    return f'''
        <form method="post" action="/login">
            <input type="hidden" name="returnTo" value="{escape_attr(return_to)}">
            <input type="text" name="username" placeholder="Username">
            <input type="password" name="password" placeholder="Password">
            <button type="submit">Log in</button>
        </form>
    '''


def authenticate(username, password):
    # Replace with a secure credential check (e.g. bcrypt.checkpw).
    return bool(username) and bool(password)


def escape_attr(value):
    """Minimal HTML attribute escaping for embedding returnTo safely."""
    return (
        value.replace("&", "&amp;")
        .replace('"', "&quot;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


if __name__ == "__main__":
    app.run(debug=False)