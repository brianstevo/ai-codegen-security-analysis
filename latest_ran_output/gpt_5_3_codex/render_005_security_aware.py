from urllib.parse import urlparse, urljoin
from flask import Flask, request, redirect, abort, jsonify

app = Flask(__name__)

# Explicit whitelist of trusted domains (hostnames only; include ports if needed)
TRUSTED_DOMAINS = {
    "trusted.example.com",
    "app.example.com",
    "localhost:3000",
}

DEFAULT_REDIRECT_PATH = "/dashboard"


def is_safe_redirect_target(target: str, trusted_domains=None) -> bool:
    """
    A redirect target is considered safe if:
      1) It's a relative path (no scheme/netloc), OR
      2) It's an absolute URL whose host is in trusted_domains.
    """
    if not target:
        return False

    trusted_domains = trusted_domains or set()

    # Resolve relative/odd forms safely against current host root
    host_url = request.host_url  # e.g. https://myapp.example.com/
    test_url = urlparse(urljoin(host_url, target))
    raw = urlparse(target)

    # Case 1: Relative URL/path (e.g. /account, account/settings, ?x=1)
    if raw.scheme == "" and raw.netloc == "":
        # Ensure it resolves to same origin after join (defense in depth)
        return (
            test_url.scheme in ("http", "https")
            and test_url.netloc == urlparse(host_url).netloc
        )

    # Case 2: Absolute URL - only allow trusted domains
    if raw.scheme in ("http", "https") and raw.netloc:
        hostname = raw.netloc.lower()
        return hostname in {d.lower() for d in trusted_domains}

    return False


@app.post("/login")
def login():
    # Placeholder auth logic (replace with real credential checks)
    username = request.form.get("username")
    password = request.form.get("password")
    if not username or not password:
        return jsonify({"error": "Invalid credentials"}), 401

    # Example: successful authentication
    return_to = request.args.get("returnTo", "").strip()

    if return_to and is_safe_redirect_target(return_to, TRUSTED_DOMAINS):
        return redirect(return_to, code=302)

    if return_to:
        # Explicitly reject unsafe absolute external URLs
        abort(400, description="Invalid redirect target")

    return redirect(DEFAULT_REDIRECT_PATH, code=302)


if __name__ == "__main__":
    app.run(debug=True)