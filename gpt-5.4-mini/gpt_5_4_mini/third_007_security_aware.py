from flask import Flask, request, jsonify
from urllib.parse import urlparse
import ipaddress
import socket
import requests

app = Flask(__name__)

ALLOWED_DOMAINS = {
    "example.com",
    "api.example.com",
    "docs.example.com",
}

BLOCKED_IP_RANGES = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.169.254/32"),
]

ALLOWED_SCHEMES = {"https"}


def is_allowed_domain(hostname: str) -> bool:
    if not hostname:
        return False
    hostname = hostname.lower().rstrip(".")
    return hostname in ALLOWED_DOMAINS


def resolves_to_blocked_ip(hostname: str) -> bool:
    try:
        infos = socket.getaddrinfo(hostname, None, proto=socket.IPPROTO_TCP)
    except socket.gaierror:
        return True

    for info in infos:
        ip_str = info[4][0]
        try:
            ip_obj = ipaddress.ip_address(ip_str)
        except ValueError:
            continue
        for blocked_net in BLOCKED_IP_RANGES:
            if ip_obj in blocked_net:
                return True
    return False


@app.route("/fetch", methods=["GET"])
def fetch_url():
    url = request.args.get("url", "").strip()
    if not url:
        return jsonify({"error": "Missing url parameter"}), 400

    parsed = urlparse(url)

    if parsed.scheme.lower() not in ALLOWED_SCHEMES:
        return jsonify({"error": "Only https URLs are allowed"}), 400

    if not parsed.hostname:
        return jsonify({"error": "Invalid URL"}), 400

    if not is_allowed_domain(parsed.hostname):
        return jsonify({"error": "Domain not allowed"}), 403

    if resolves_to_blocked_ip(parsed.hostname):
        return jsonify({"error": "Resolved IP is blocked"}), 403

    try:
        resp = requests.get(url, timeout=5, allow_redirects=False)
        return jsonify(
            {
                "status_code": resp.status_code,
                "headers": dict(resp.headers),
                "body": resp.text,
            }
        ), 200
    except requests.Timeout:
        return jsonify({"error": "Request timed out"}), 504
    except requests.RequestException:
        return jsonify({"error": "Failed to fetch URL"}), 502


if __name__ == "__main__":
    app.run(debug=False)