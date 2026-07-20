import os
import re
import socket
import ssl
from ipaddress import ip_address, ip_network
from urllib.parse import urljoin, urlsplit, urlunsplit

import urllib3
from flask import Flask, Response, jsonify, request

app = Flask(__name__)

ALLOWED_DOMAINS = {
    d.strip().lower().rstrip(".")
    for d in os.getenv("ALLOWED_FETCH_DOMAINS", "example.com").split(",")
    if d.strip()
}

REQUEST_TIMEOUT_SECONDS = 5.0
MAX_REDIRECTS = 3
MAX_RESPONSE_BYTES = 2 * 1024 * 1024

BLOCKED_NETWORKS = [
    ip_network("10.0.0.0/8"),
    ip_network("172.16.0.0/12"),
    ip_network("192.168.0.0/16"),
    ip_network("127.0.0.0/8"),
    ip_network("169.254.169.254/32"),
    ip_network("169.254.0.0/16"),
    ip_network("::1/128"),
    ip_network("fc00::/7"),
    ip_network("fe80::/10"),
]

CONTROL_CHARS_RE = re.compile(r"[\x00-\x1f\x7f]")


class URLValidationError(ValueError):
    pass


def canonicalize_hostname(hostname: str) -> str:
    if not hostname:
        raise URLValidationError("URL hostname is required")

    hostname = hostname.strip().rstrip(".").lower()

    if not hostname:
        raise URLValidationError("URL hostname is required")

    try:
        return hostname.encode("idna").decode("ascii")
    except UnicodeError:
        raise URLValidationError("Invalid hostname")


def is_allowed_domain(hostname: str) -> bool:
    return any(hostname == domain or hostname.endswith(f".{domain}") for domain in ALLOWED_DOMAINS)


def validate_ip_not_blocked(ip_text: str) -> str:
    try:
        ip = ip_address(ip_text)
    except ValueError:
        raise URLValidationError("Invalid resolved IP address")

    if getattr(ip, "ipv4_mapped", None):
        ip = ip.ipv4_mapped

    for network in BLOCKED_NETWORKS:
        if ip.version == network.version and ip in network:
            raise URLValidationError("Resolved IP address is blocked")

    if (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    ):
        raise URLValidationError("Resolved IP address is not allowed")

    return str(ip)


def resolve_and_validate_hostname(hostname: str, port: int) -> list[str]:
    try:
        direct_ip = ip_address(hostname)
        return [validate_ip_not_blocked(str(direct_ip))]
    except ValueError:
        pass

    try:
        addrinfo = socket.getaddrinfo(
            hostname,
            port,
            type=socket.SOCK_STREAM,
            proto=socket.IPPROTO_TCP,
        )
    except socket.gaierror:
        raise URLValidationError("Hostname could not be resolved")

    resolved_ips = []
    seen = set()

    for family, _, _, _, sockaddr in addrinfo:
        if family not in (socket.AF_INET, socket.AF_INET6):
            continue

        ip_text = sockaddr[0]
        safe_ip = validate_ip_not_blocked(ip_text)

        if safe_ip not in seen:
            seen.add(safe_ip)
            resolved_ips.append(safe_ip)

    if not resolved_ips:
        raise URLValidationError("Hostname did not resolve to a usable address")

    return resolved_ips


def validate_url(raw_url: str) -> dict:
    if not isinstance(raw_url, str) or not raw_url.strip():
        raise URLValidationError("URL is required")

    raw_url = raw_url.strip()

    if CONTROL_CHARS_RE.search(raw_url) or "\\" in raw_url:
        raise URLValidationError("URL contains invalid characters")

    parsed = urlsplit(raw_url)

    if parsed.scheme.lower() != "https":
        raise URLValidationError("Only HTTPS URLs are allowed")

    if not parsed.netloc or not parsed.hostname:
        raise URLValidationError("URL must include a hostname")

    if parsed.username or parsed.password:
        raise URLValidationError("Userinfo in URLs is not allowed")

    hostname = canonicalize_hostname(parsed.hostname)

    if not is_allowed_domain(hostname):
        raise URLValidationError("Domain is not allowed")

    port = parsed.port or 443

    if port < 1 or port > 65535:
        raise URLValidationError("Invalid port")

    resolved_ips = resolve_and_validate_hostname(hostname, port)

    path = parsed.path or "/"
    if parsed.query:
        path = f"{path}?{parsed.query}"

    normalized_netloc = hostname if port == 443 else f"{hostname}:{port}"
    normalized_url = urlunsplit(("https", normalized_netloc, parsed.path or "/", parsed.query, ""))

    return {
        "url": normalized_url,
        "hostname": hostname,
        "port": port,
        "path": path,
        "resolved_ips": resolved_ips,
    }


def fetch_once(validated: dict) -> tuple[int, dict, bytes]:
    ip = validated["resolved_ips"][0]
    hostname = validated["hostname"]
    port = validated["port"]

    host_header = hostname if port == 443 else f"{hostname}:{port}"

    ssl_context = ssl.create_default_context()

    pool = urllib3.HTTPSConnectionPool(
        host=ip,
        port=port,
        timeout=urllib3.Timeout(
            total=REQUEST_TIMEOUT_SECONDS,
            connect=REQUEST_TIMEOUT_SECONDS,
            read=REQUEST_TIMEOUT_SECONDS,
        ),
        maxsize=1,
        block=True,
        ssl_context=ssl_context,
        server_hostname=hostname,
        assert_hostname=hostname,
        retries=False,
    )

    response = None

    try:
        response = pool.urlopen(
            "GET",
            validated["path"],
            headers={
                "Host": host_header,
                "User-Agent": "safe-flask-url-fetcher/1.0",
                "Accept": "*/*",
            },
            redirect=False,
            preload_content=False,
        )

        body = bytearray()

        for chunk in response.stream(amt=65536):
            if not chunk:
                continue

            body.extend(chunk)

            if len(body) > MAX_RESPONSE_BYTES:
                raise URLValidationError("Response body is too large")

        headers = {k.lower(): v for k, v in response.headers.items()}
        return response.status, headers, bytes(body)

    finally:
        if response is not None:
            response.release_conn()
        pool.close()


def safe_fetch_url(raw_url: str) -> tuple[int, dict, bytes, str]:
    current_url = raw_url

    for _ in range(MAX_REDIRECTS + 1):
        validated = validate_url(current_url)
        status, headers, body = fetch_once(validated)

        if status in {301, 302, 303, 307, 308} and headers.get("location"):
            current_url = urljoin(validated["url"], headers["location"])
            continue

        return status, headers, body, validated["url"]

    raise URLValidationError("Too many redirects")


@app.route("/fetch", methods=["POST"])
def fetch_url():
    payload = request.get_json(silent=True) or {}
    raw_url = payload.get("url")

    try:
        status, headers, body, final_url = safe_fetch_url(raw_url)
    except URLValidationError as exc:
        return jsonify({"error": str(exc)}), 400
    except urllib3.exceptions.TimeoutError:
        return jsonify({"error": "Upstream request timed out"}), 504
    except urllib3.exceptions.SSLError:
        return jsonify({"error": "Upstream TLS verification failed"}), 502
    except urllib3.exceptions.HTTPError:
        return jsonify({"error": "Upstream request failed"}), 502

    content_type = headers.get("content-type", "application/octet-stream")

    return Response(
        body,
        status=status,
        content_type=content_type,
        headers={
            "X-Final-URL": final_url,
            "X-Content-Type-Options": "nosniff",
        },
    )


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)