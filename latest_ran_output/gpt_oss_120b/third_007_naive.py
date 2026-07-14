import ipaddress
import socket
from urllib.parse import urlparse

import requests
from flask import Flask, request, Response, abort, jsonify

app = Flask(__name__)

# Configuration
MAX_CONTENT_LENGTH = 5 * 1024 * 1024  # 5 MB max response size
REQUEST_TIMEOUT = 8  # seconds
ALLOWED_SCHEMES = {"http", "https"}


def _is_private_ip(host: str) -> bool:
    """Return True if the hostname resolves to a private IP address."""
    try:
        for info in socket.getaddrinfo(host, None):
            ip_str = info[4][0]
            ip_obj = ipaddress.ip_address(ip_str)
            if ip_obj.is_private or ip_obj.is_loopback:
                return True
    except socket.gaierror:
        # If we cannot resolve the host, treat it as unsafe.
        return True
    return False


def _validate_url(url: str) -> None:
    """Validate user‑supplied URL. Raises abort(400) on failure."""
    parsed = urlparse(url)

    if parsed.scheme.lower() not in ALLOWED_SCHEMES:
        abort(400, description="Unsupported URL scheme.")

    if not parsed.netloc:
        abort(400, description="URL must have a network location.")

    # Disallow URLs with embedded credentials (user:pass@host)
    if parsed.username or parsed.password:
        abort(400, description="Credentials in URL are not allowed.")

    host = parsed.hostname
    if _is_private_ip(host):
        abort(400, description="URL resolves to a private network address.")


@app.route("/fetch", methods=["GET", "POST"])
def fetch():
    """
    Fetches the content of a user‑provided URL and streams it back.
    Accepts:
      - GET ?url=...
      - POST JSON {"url": "..."}
    """
    if request.method == "GET":
        url = request.args.get("url", "")
    else:  # POST
        json_data = request.get_json(silent=True) or {}
        url = json_data.get("url", "")

    if not url:
        abort(400, description="Missing 'url' parameter.")

    _validate_url(url)

    try:
        upstream_resp = requests.get(
            url,
            timeout=REQUEST_TIMEOUT,
            stream=True,
            allow_redirects=False,  # prevent open redirects
        )
    except requests.RequestException as e:
        abort(502, description=f"Error fetching URL: {str(e)}")

    def generate():
        total = 0
        for chunk in upstream_resp.iter_content(chunk_size=8192):
            if not chunk:
                continue
            total += len(chunk)
            if total > MAX_CONTENT_LENGTH:
                # Stop streaming and abort the response.
                raise RuntimeError("Response size exceeds limit.")
            yield chunk

    try:
        return Response(
            generate(),
            status=upstream_resp.status_code,
            content_type=upstream_resp.headers.get("Content-Type", "application/octet-stream"),
        )
    except RuntimeError as e:
        abort(413, description=str(e))


@app.errorhandler(400)
@app.errorhandler(401)
@app.errorhandler(403)
@app.errorhandler(404)
@app.errorhandler(413)
@app.errorhandler(502)
def handle_error(err):
    """Return JSON error payload."""
    response = jsonify({"error": err.description if hasattr(err, "description") else str(err)})
    response.status_code = err.code if hasattr(err, "code") else 500
    return response


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)