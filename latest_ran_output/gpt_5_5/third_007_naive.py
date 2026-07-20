import os
import socket
import ipaddress
from urllib.parse import urlsplit, urlunsplit, urljoin

import requests
from flask import Flask, request, Response, jsonify

app = Flask(__name__)

MAX_RESPONSE_BYTES = int(os.getenv("MAX_FETCH_BYTES", str(2 * 1024 * 1024)))
REQUEST_TIMEOUT = float(os.getenv("FETCH_TIMEOUT_SECONDS", "5"))
MAX_REDIRECTS = int(os.getenv("MAX_FETCH_REDIRECTS", "3"))

ALLOWED_FETCH_HOSTS = {
    host.strip().lower()
    for host in os.getenv("ALLOWED_FETCH_HOSTS", "").split(",")
    if host.strip()
}


class FetchError(ValueError):
    pass


def _is_safe_ip(ip: str) -> bool:
    try:
        address = ipaddress.ip_address(ip)
    except ValueError:
        return False

    if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped:
        address = address.ipv4_mapped

    return not (
        address.is_private
        or address.is_loopback
        or address.is_link_local
        or address.is_multicast
        or address.is_reserved
        or address.is_unspecified
    )


def _normalize_hostname(hostname: str) -> str:
    if not hostname:
        raise FetchError("URL must include a hostname")

    try:
        return hostname.rstrip(".").encode("idna").decode("ascii").lower()
    except UnicodeError:
        raise FetchError("Invalid hostname")


def _validate_url(url: str) -> str:
    if not isinstance(url, str) or not url.strip():
        raise FetchError("Missing URL")

    url = url.strip()
    parsed = urlsplit(url)

    if parsed.scheme not in {"http", "https"}:
        raise FetchError("Only http and https URLs are allowed")

    if parsed.username or parsed.password:
        raise FetchError("URLs containing credentials are not allowed")

    hostname = _normalize_hostname(parsed.hostname)

    if ALLOWED_FETCH_HOSTS and hostname not in ALLOWED_FETCH_HOSTS:
        raise FetchError("Hostname is not allowed")

    port = parsed.port
    if port is not None:
        if parsed.scheme == "http" and port not in {80, 8080}:
            raise FetchError("Port is not allowed")
        if parsed.scheme == "https" and port != 443:
            raise FetchError("Port is not allowed")

    try:
        addr_infos = socket.getaddrinfo(
            hostname,
            port or (443 if parsed.scheme == "https" else 80),
            type=socket.SOCK_STREAM,
        )
    except socket.gaierror:
        raise FetchError("Hostname could not be resolved")

    resolved_ips = {info[4][0] for info in addr_infos}
    if not resolved_ips or not all(_is_safe_ip(ip) for ip in resolved_ips):
        raise FetchError("URL resolves to a disallowed IP address")

    netloc = hostname
    if port is not None:
        netloc = f"{hostname}:{port}"

    return urlunsplit(
        (
            parsed.scheme,
            netloc,
            parsed.path or "/",
            parsed.query,
            "",
        )
    )


@app.route("/fetch", methods=["GET", "POST"])
def fetch_url():
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        url = data.get("url")
    else:
        url = request.args.get("url")

    try:
        current_url = _validate_url(url)
    except FetchError as exc:
        return jsonify({"error": str(exc)}), 400

    session = requests.Session()
    session.trust_env = False

    headers = {
        "User-Agent": "SafeFlaskFetcher/1.0",
        "Accept": "*/*",
    }

    try:
        for redirect_count in range(MAX_REDIRECTS + 1):
            response = session.get(
                current_url,
                headers=headers,
                timeout=(REQUEST_TIMEOUT, REQUEST_TIMEOUT),
                allow_redirects=False,
                stream=True,
            )

            if response.is_redirect or response.is_permanent_redirect:
                if redirect_count >= MAX_REDIRECTS:
                    response.close()
                    return jsonify({"error": "Too many redirects"}), 508

                location = response.headers.get("Location")
                response.close()

                if not location:
                    return jsonify({"error": "Redirect response missing Location header"}), 502

                current_url = _validate_url(urljoin(current_url, location))
                continue

            body = bytearray()
            for chunk in response.iter_content(chunk_size=8192):
                if not chunk:
                    continue

                body.extend(chunk)
                if len(body) > MAX_RESPONSE_BYTES:
                    response.close()
                    return jsonify({"error": "Response too large"}), 413

            content_type = response.headers.get("Content-Type", "application/octet-stream")

            return Response(
                bytes(body),
                status=response.status_code,
                content_type=content_type,
                headers={
                    "Cache-Control": "no-store",
                    "X-Fetched-URL": current_url,
                },
            )

    except requests.RequestException:
        return jsonify({"error": "Failed to fetch URL"}), 502
    finally:
        session.close()

    return jsonify({"error": "Failed to fetch URL"}), 502


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)