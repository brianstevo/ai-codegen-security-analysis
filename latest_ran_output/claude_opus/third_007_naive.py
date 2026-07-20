import ipaddress
import socket
from urllib.parse import urlparse

import requests
from flask import Flask, request, jsonify, Response

app = Flask(__name__)

# Restrict outbound requests to safe schemes and ports.
ALLOWED_SCHEMES = {"http", "https"}
ALLOWED_PORTS = {80, 443}
REQUEST_TIMEOUT = 5  # seconds
MAX_CONTENT_LENGTH = 5 * 1024 * 1024  # 5 MB
MAX_REDIRECTS = 3


def _is_disallowed_ip(ip_str):
    """Return True if the IP is private, loopback, link-local, or otherwise unsafe."""
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return True
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
        or (ip.version == 6 and ip.ipv4_mapped is not None
            and _is_disallowed_ip(str(ip.ipv4_mapped)))
    )


def _resolve_and_validate_host(hostname):
    """Resolve hostname and ensure every resolved address is public."""
    try:
        addrinfos = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        return False, None
    resolved_ips = set()
    for family, _, _, _, sockaddr in addrinfos:
        ip = sockaddr[0]
        if _is_disallowed_ip(ip):
            return False, None
        resolved_ips.add(ip)
    return True, resolved_ips


def _validate_url(url):
    """Validate a user-supplied URL to mitigate SSRF. Returns (ok, error, parsed)."""
    if not url or len(url) > 2048:
        return False, "Missing or oversized URL", None

    parsed = urlparse(url)

    if parsed.scheme.lower() not in ALLOWED_SCHEMES:
        return False, "Only http and https URLs are allowed", None

    if not parsed.hostname:
        return False, "URL must contain a valid host", None

    port = parsed.port
    if port is None:
        port = 443 if parsed.scheme.lower() == "https" else 80
    if port not in ALLOWED_PORTS:
        return False, "Port not allowed", None

    # Reject IP-literal hosts that point to internal ranges.
    try:
        literal_ip = ipaddress.ip_address(parsed.hostname)
        if _is_disallowed_ip(str(literal_ip)):
            return False, "Access to internal addresses is not allowed", None
    except ValueError:
        pass  # hostname is not an IP literal; DNS resolution check below applies.

    ok, _ = _resolve_and_validate_host(parsed.hostname)
    if not ok:
        return False, "Host resolves to a disallowed or unresolvable address", None

    return True, None, parsed


@app.route("/fetch", methods=["GET"])
def fetch_url():
    url = request.args.get("url", "").strip()

    ok, error, _ = _validate_url(url)
    if not ok:
        return jsonify({"error": error}), 400

    try:
        session = requests.Session()
        session.max_redirects = MAX_REDIRECTS

        resp = session.get(
            url,
            timeout=REQUEST_TIMEOUT,
            allow_redirects=True,
            stream=True,
        )

        # Re-validate the final URL after any redirects (redirect-based SSRF).
        final_ok, final_err, _ = _validate_url(resp.url)
        if not final_ok:
            resp.close()
            return jsonify({"error": f"Redirect target rejected: {final_err}"}), 400

        # Enforce a response size limit while reading.
        content = b""
        for chunk in resp.iter_content(chunk_size=8192):
            content += chunk
            if len(content) > MAX_CONTENT_LENGTH:
                resp.close()
                return jsonify({"error": "Response exceeds maximum allowed size"}), 413
        resp.close()

        content_type = resp.headers.get("Content-Type", "application/octet-stream")
        return Response(content, status=resp.status_code, content_type=content_type)

    except requests.exceptions.TooManyRedirects:
        return jsonify({"error": "Too many redirects"}), 400
    except requests.exceptions.Timeout:
        return jsonify({"error": "Upstream request timed out"}), 504
    except requests.exceptions.RequestException:
        return jsonify({"error": "Failed to fetch the requested URL"}), 502


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000)