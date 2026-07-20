from flask import Flask, request, jsonify
from urllib.parse import urlparse
import ipaddress
import socket
import requests

app = Flask(__name__)

ALLOWED_DOMAINS = {
    "example.com",
    "api.example.com",
    "service.example.org",
}

ALLOWED_SCHEMES = {"https"}
REQUEST_TIMEOUT_SECONDS = 5


def is_private_or_link_local_ip(hostname: str) -> bool:
    try:
        ip = ipaddress.ip_address(hostname)
        return (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip == ipaddress.ip_address("169.254.169.254")
        )
    except ValueError:
        return False


def resolve_hostname_ips(hostname: str):
    ips = set()
    try:
        for res in socket.getaddrinfo(hostname, None):
            sockaddr = res[4]
            if sockaddr and sockaddr[0]:
                ips.add(sockaddr[0])
    except socket.gaierror:
        pass
    return ips


def is_allowed_domain(hostname: str) -> bool:
    hostname = hostname.lower().strip(".")
    return any(
        hostname == domain or hostname.endswith("." + domain)
        for domain in ALLOWED_DOMAINS
    )


@app.route("/fetch-url", methods=["POST"])
def fetch_url():
    data = request.get_json(silent=True) or {}
    url = data.get("url", "").strip()

    if not url:
        return jsonify({"error": "Missing url"}), 400

    parsed = urlparse(url)

    if parsed.scheme.lower() not in ALLOWED_SCHEMES:
        return jsonify({"error": "Only https URLs are allowed"}), 400

    if not parsed.hostname:
        return jsonify({"error": "Invalid URL"}), 400

    hostname = parsed.hostname.lower()

    if not is_allowed_domain(hostname):
        return jsonify({"error": "Domain not allowed"}), 403

    resolved_ips = resolve_hostname_ips(hostname)
    for ip_str in resolved_ips:
        try:
            ip_obj = ipaddress.ip_address(ip_str)
            if (
                ip_obj.is_private
                or ip_obj.is_loopback
                or ip_obj.is_link_local
                or ip_obj == ipaddress.ip_address("169.254.169.254")
            ):
                return jsonify({"error": "Resolved IP is not allowed"}), 403
        except ValueError:
            continue

    if is_private_or_link_local_ip(hostname):
        return jsonify({"error": "IP address not allowed"}), 403

    try:
        resp = requests.get(
            url,
            timeout=REQUEST_TIMEOUT_SECONDS,
            allow_redirects=False,
            headers={"User-Agent": "FlaskURLFetcher/1.0"},
        )
    except requests.RequestException as e:
        return jsonify({"error": "Request failed", "details": str(e)}), 502

    return jsonify(
        {
            "status_code": resp.status_code,
            "headers": {k: v for k, v in resp.headers.items()},
            "body": resp.text,
        }
    ), 200


if __name__ == "__main__":
    app.run(debug=False)