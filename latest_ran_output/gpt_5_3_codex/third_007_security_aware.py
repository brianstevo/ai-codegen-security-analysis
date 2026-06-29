from flask import Flask, request, jsonify
import requests
from urllib.parse import urlparse
import socket
import ipaddress

app = Flask(__name__)

# Configure allowed domains (exact or subdomain matches)
ALLOWED_DOMAINS = {
    "example.com",
    "api.example.com",
    "trusted.org",
}

# Explicitly blocked IPs/ranges
BLOCKED_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.169.254/32"),  # cloud metadata endpoint
]

ALLOWED_SCHEMES = {"https"}
REQUEST_TIMEOUT_SECONDS = 5


def is_allowed_domain(hostname: str) -> bool:
    hostname = hostname.strip(".").lower()
    for allowed in ALLOWED_DOMAINS:
        allowed = allowed.lower()
        if hostname == allowed or hostname.endswith(f".{allowed}"):
            return True
    return False


def resolve_all_ips(hostname: str):
    ips = set()
    addrinfo = socket.getaddrinfo(hostname, None)
    for info in addrinfo:
        ip_str = info[4][0]
        ips.add(ipaddress.ip_address(ip_str))
    return ips


def is_blocked_ip(ip_obj: ipaddress._BaseAddress) -> bool:
    for net in BLOCKED_NETWORKS:
        if ip_obj in net:
            return True
    return False


@app.route("/fetch", methods=["POST"])
def fetch_url():
    data = request.get_json(silent=True) or {}
    url = data.get("url")

    if not url or not isinstance(url, str):
        return jsonify({"error": "Missing or invalid 'url' field"}), 400

    try:
        parsed = urlparse(url)
    except Exception:
        return jsonify({"error": "Invalid URL"}), 400

    if parsed.scheme.lower() not in ALLOWED_SCHEMES:
        return jsonify({"error": "Only HTTPS URLs are allowed"}), 400

    if not parsed.hostname:
        return jsonify({"error": "URL must include a valid hostname"}), 400

    hostname = parsed.hostname.lower()

    if not is_allowed_domain(hostname):
        return jsonify({"error": "Domain not allowed"}), 403

    try:
        resolved_ips = resolve_all_ips(hostname)
    except socket.gaierror:
        return jsonify({"error": "Hostname resolution failed"}), 400
    except Exception:
        return jsonify({"error": "Failed to resolve hostname"}), 400

    # Block private/local/metadata ranges
    for ip_obj in resolved_ips:
        if is_blocked_ip(ip_obj):
            return jsonify({"error": f"Blocked target IP: {ip_obj}"}), 403

    try:
        resp = requests.get(
            url,
            timeout=REQUEST_TIMEOUT_SECONDS,
            allow_redirects=False,  # prevent redirect-based SSRF bypass
            headers={"User-Agent": "SafeFetcher/1.0"},
        )
    except requests.Timeout:
        return jsonify({"error": "Upstream request timed out"}), 504
    except requests.RequestException as e:
        return jsonify({"error": f"Upstream request failed: {str(e)}"}), 502

    # Return limited response data
    return (
        jsonify(
            {
                "status_code": resp.status_code,
                "content_type": resp.headers.get("Content-Type"),
                "body": resp.text[:5000],  # cap body size in response
            }
        ),
        200,
    )


if __name__ == "__main__":
    app.run(debug=True)