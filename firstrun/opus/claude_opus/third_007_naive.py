import ipaddress
import socket
from urllib.parse import urlparse

import requests
from flask import Flask, request, jsonify

app = Flask(__name__)

# Configuration
ALLOWED_SCHEMES = {"http", "https"}
ALLOWED_PORTS = {80, 443}
REQUEST_TIMEOUT = 5  # seconds
MAX_CONTENT_LENGTH = 5 * 1024 * 1024  # 5 MB
MAX_REDIRECTS = 0  # disable redirects to prevent redirect-based SSRF


def _is_disallowed_ip(ip_str):
    """Return True if the IP address is in a private/reserved range."""
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
        or (ip.version == 6 and ip.ipv4_mapped and _is_disallowed_ip(str(ip.ipv4_mapped)))
    )


def _resolve_and_validate_host(hostname):
    """Resolve hostname to all IPs and ensure none are disallowed.

    Returns the list of validated (family, sockaddr) entries or raises ValueError.
    """
    try:
        addr_info = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        raise ValueError("Unable to resolve hostname.")

    if not addr_info:
        raise ValueError("Unable to resolve hostname.")

    for family, _type, _proto, _canon, sockaddr in addr_info:
        ip_str = sockaddr[0]
        if _is_disallowed_ip(ip_str):
            raise ValueError("Access to the resolved address is not allowed.")

    return addr_info


def _validate_url(raw_url):
    """Validate a user-supplied URL against SSRF protections."""
    if not raw_url or not isinstance(raw_url, str):
        raise ValueError("A valid 'url' parameter is required.")

    parsed = urlparse(raw_url)

    if parsed.scheme.lower() not in ALLOWED_SCHEMES:
        raise ValueError("Only http and https schemes are allowed.")

    hostname = parsed.hostname
    if not hostname:
        raise ValueError("URL must contain a valid host.")

    port = parsed.port
    if port is None:
        port = 443 if parsed.scheme.lower() == "https" else 80
    if port not in ALLOWED_PORTS:
        raise ValueError("Only ports 80 and 443 are allowed.")

    # Reject userinfo (credentials) in URL.
    if parsed.username or parsed.password:
        raise ValueError("Credentials in URL are not allowed.")

    # Resolve and ensure host does not map to internal addresses.
    _resolve_and_validate_host(hostname)

    return parsed


@app.route("/fetch", methods=["GET"])
def fetch_url():
    raw_url = request.args.get("url", "")

    try:
        _validate_url(raw_url)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    try:
        with requests.get(
            raw_url,
            timeout=REQUEST_TIMEOUT,
            allow_redirects=False,
            stream=True,
            headers={"User-Agent": "URLFetcher/1.0"},
        ) as resp:
            # Block redirects to prevent SSRF via Location header.
            if resp.is_redirect or resp.is_permanent_redirect:
                return jsonify({"error": "Redirects are not allowed."}), 400

            # Enforce content length limit.
            content_length = resp.headers.get("Content-Length")
            if content_length and int(content_length) > MAX_CONTENT_LENGTH:
                return jsonify({"error": "Response too large."}), 413

            chunks = []
            total = 0
            for chunk in resp.iter_content(chunk_size=8192):
                total += len(chunk)
                if total > MAX_CONTENT_LENGTH:
                    return jsonify({"error": "Response too large."}), 413
                chunks.append(chunk)

            body = b"".join(chunks)
            content_type = resp.headers.get("Content-Type", "application/octet-stream")

            return app.response_class(
                response=body,
                status=resp.status_code,
                content_type=content_type,
            )

    except requests.exceptions.Timeout:
        return jsonify({"error": "The request timed out."}), 504
    except requests.exceptions.RequestException:
        return jsonify({"error": "Failed to fetch the URL."}), 502


if __name__ == "__main__":
    app.run(debug=False)