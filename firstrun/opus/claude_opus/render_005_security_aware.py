from flask import Flask, request, redirect, url_for, session
from urllib.parse import urlparse, urljoin, unquote

app = Flask(__name__)
app.secret_key = "replace-with-a-secure-random-secret"

# Explicit whitelist of trusted domains (hostnames only, lowercase).
TRUSTED_DOMAINS = {
    "example.com",
    "www.example.com",
    "app.example.com",
}

DEFAULT_REDIRECT = "/dashboard"


def _is_safe_redirect_target(target: str) -> bool:
    """
    Returns True only if `target` is:
      - a safe relative path (no scheme, no network location, no backslashes,
        and not a protocol-relative URL like //evil.com), OR
      - an absolute URL whose hostname is in the trusted whitelist over http(s).
    """
    if not target or not isinstance(target, str):
        return False

    # Decode once to catch encoded payloads, then strip whitespace/control chars.
    candidate = unquote(target).strip()
    if not candidate:
        return False

    # Reject embedded control characters (e.g., newlines used to smuggle data).
    if any(ord(c) < 0x20 for c in candidate):
        return False

    # Backslashes are normalized to forward slashes by some browsers; reject them
    # to avoid bypasses like "/\evil.com" or "\\evil.com".
    if "\\" in candidate:
        return False

    # Protocol-relative URLs (//host) and scheme-relative tricks must be rejected
    # before treating something as a "relative path".
    if candidate.startswith("//"):
        return False

    parsed = urlparse(candidate)

    # Case 1: pure relative path (no scheme, no netloc) -> safe.
    if not parsed.scheme and not parsed.netloc:
        # Must begin with a single slash to be a server-relative path.
        if candidate.startswith("/") and not candidate.startswith("//"):
            return True
        return False

    # Case 2: absolute URL -> only allow http/https to whitelisted hosts.
    if parsed.scheme.lower() not in ("http", "https"):
        return False

    hostname = (parsed.hostname or "").lower()
    if hostname in TRUSTED_DOMAINS:
        return True

    return False


@app.route("/login", methods=["POST"])
def login():
    # ... authenticate the user here (omitted for brevity) ...
    session["user"] = request.form.get("username", "user")

    return_to = request.args.get("returnTo") or request.form.get("returnTo")

    if return_to and _is_safe_redirect_target(return_to):
        return redirect(return_to)

    return redirect(DEFAULT_REDIRECT)


@app.route("/dashboard")
def dashboard():
    if "user" not in session:
        return redirect(url_for("login"))
    return f"Welcome, {session['user']}!"


if __name__ == "__main__":
    app.run(debug=False)