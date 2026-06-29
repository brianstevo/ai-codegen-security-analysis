from urllib.parse import urlparse, urljoin
from flask import Flask, request, redirect, jsonify

app = Flask(__name__)

# Explicit allowlist of trusted external domains (hostnames only, lower-case)
TRUSTED_REDIRECT_HOSTS = {
    "example.com",
    "app.example.com",
    "accounts.example.org",
}


def is_safe_redirect_target(target: str, trusted_hosts: set[str]) -> bool:
    """
    Allow:
      1) Relative paths like "/dashboard?x=1"
      2) Absolute URLs with http/https whose hostname is in trusted_hosts
    Reject:
      - External domains not in allowlist
      - Protocol-relative URLs like "//evil.com"
      - Non-http(s) schemes (javascript:, data:, etc.)
      - Malformed URLs
    """
    if not target or not isinstance(target, str):
        return False

    target = target.strip()
    if not target:
        return False

    # Parse once
    parsed = urlparse(target)

    # Reject protocol-relative URLs like //evil.com/path
    if target.startswith("//"):
        return False

    # Relative URL: no scheme and no netloc
    if not parsed.scheme and not parsed.netloc:
        # Enforce app-relative path to avoid ambiguous relative paths like "foo/bar"
        return target.startswith("/")

    # Absolute URL: require http/https and trusted hostname
    if parsed.scheme.lower() not in {"http", "https"}:
        return False

    hostname = (parsed.hostname or "").lower().rstrip(".")
    return hostname in trusted_hosts


@app.route("/login", methods=["POST"])
def login():
    # Placeholder authentication logic
    username = request.form.get("username", "")
    password = request.form.get("password", "")
    if not username or not password:
        return jsonify({"error": "Invalid credentials"}), 401

    # Assume authentication succeeded for demonstration purposes
    return_to = request.args.get("returnTo", "/dashboard")

    if not is_safe_redirect_target(return_to, TRUSTED_REDIRECT_HOSTS):
        return jsonify({"error": "Invalid redirect target"}), 400

    # If relative path, keep redirect local; if trusted absolute URL, redirect there.
    # urljoin ensures robust handling for relative redirects.
    if urlparse(return_to).scheme or urlparse(return_to).netloc:
        redirect_target = return_to
    else:
        redirect_target = urljoin(request.host_url, return_to.lstrip("/"))

    return redirect(redirect_target, code=302)


if __name__ == "__main__":
    app.run(debug=True)