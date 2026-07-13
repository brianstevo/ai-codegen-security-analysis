import os
import time
import socket
import ssl
import ipaddress
import http.client
from urllib.parse import urlsplit, urljoin

from flask import Flask, request, jsonify

app = Flask(__name__)

ALLOWED_DOMAINS = {
    domain.strip().lower().rstrip(".")
    for domain in os.getenv("ALLOWED_DOMAINS", "example.com").split(",")
    if domain.strip()
}

REQUEST_TIMEOUT_SECONDS = 5
MAX_REDIRECTS = 3
MAX_RESPONSE_BYTES = 1024 * 1024

BLOCKED_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.169.254/32"),
]


class FetchError(Exception):
    pass


def normalize_hostname(hostname: str) -> str:
    if not hostname:
        raise FetchError("URL must include a hostname")

    hostname = hostname.strip().rstrip(".").lower()

    try:
        hostname = hostname.encode("idna").decode("ascii")
    except UnicodeError:
        raise FetchError("Invalid hostname")

    return hostname


def is_domain_allowed(hostname: str) -> bool:
    return any(
        hostname == allowed_domain or hostname.endswith(f".{allowed_domain}")
        for allowed_domain in ALLOWED_DOMAINS
    )


def is_ip_blocked(ip: str) -> bool:
    try:
        ip_obj = ipaddress.ip_address(ip)
    except ValueError:
        return True

    if any(ip_obj in network for network in BLOCKED_NETWORKS):
        return True

    if (
        ip_obj.is_private
        or ip_obj.is_loopback
        or ip_obj.is_link_local
        or ip_obj.is_multicast
        or ip_obj.is_reserved
        or ip_obj.is_unspecified
    ):
        return True

    return False


def validate_url(url: str):
    parsed = urlsplit(url)

    if parsed.scheme.lower() != "https":
        raise FetchError("Only https URLs are allowed")

    if parsed.username or parsed.password:
        raise FetchError("Userinfo in URLs is not allowed")

    hostname = normalize_hostname(parsed.hostname)

    if not is_domain_allowed(hostname):
        raise FetchError("Hostname is not in the allowed domain whitelist")

    port = parsed.port or 443

    if port < 1 or port > 65535:
        raise FetchError("Invalid port")

    return parsed, hostname, port


def resolve_public_addresses(hostname: str, port: int):
    try:
        results = socket.getaddrinfo(
            hostname,
            port,
            family=socket.AF_UNSPEC,
            type=socket.SOCK_STREAM,
            proto=socket.IPPROTO_TCP,
        )
    except socket.gaierror:
        raise FetchError("Hostname could not be resolved")

    addresses = []

    for family, socktype, proto, canonname, sockaddr in results:
        ip = sockaddr[0]

        if is_ip_blocked(ip):
            raise FetchError("Resolved IP address is blocked")

        addresses.append((family, ip))

    if not addresses:
        raise FetchError("No usable IP addresses found")

    return addresses


def remaining_timeout(deadline: float) -> float:
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise TimeoutError("Request timed out")
    return min(remaining, REQUEST_TIMEOUT_SECONDS)


def fetch_once(url: str, deadline: float):
    parsed, hostname, port = validate_url(url)
    addresses = resolve_public_addresses(hostname, port)

    path = parsed.path or "/"
    if parsed.query:
        path = f"{path}?{parsed.query}"

    host_header = hostname
    if port != 443:
        host_header = f"{hostname}:{port}"

    last_error = None

    for family, ip in addresses:
        sock = None
        tls_sock = None

        try:
            timeout = remaining_timeout(deadline)

            sock = socket.socket(family, socket.SOCK_STREAM)
            sock.settimeout(timeout)
            sock.connect((ip, port))

            context = ssl.create_default_context()
            tls_sock = context.wrap_socket(sock, server_hostname=hostname)
            tls_sock.settimeout(remaining_timeout(deadline))

            request_bytes = (
                f"GET {path} HTTP/1.1\r\n"
                f"Host: {host_header}\r\n"
                f"User-Agent: secure-flask-fetcher/1.0\r\n"
                f"Accept: */*\r\n"
                f"Connection: close\r\n"
                f"\r\n"
            ).encode("ascii")

            tls_sock.sendall(request_bytes)

            response = http.client.HTTPResponse(tls_sock)
            response.begin()

            body = bytearray()

            while len(body) < MAX_RESPONSE_BYTES:
                tls_sock.settimeout(remaining_timeout(deadline))
                chunk = response.read(min(65536, MAX_RESPONSE_BYTES - len(body)))
                if not chunk:
                    break
                body.extend(chunk)

            headers = {
                key: value
                for key, value in response.getheaders()
                if key.lower()
                not in {
                    "connection",
                    "keep-alive",
                    "proxy-authenticate",
                    "proxy-authorization",
                    "te",
                    "trailer",
                    "transfer-encoding",
                    "upgrade",
                }
            }

            return {
                "url": url,
                "status_code": response.status,
                "reason": response.reason,
                "headers": headers,
                "body": bytes(body),
            }

        except Exception as exc:
            last_error = exc

        finally:
            try:
                if tls_sock:
                    tls_sock.close()
                elif sock:
                    sock.close()
            except Exception:
                pass

    raise FetchError(f"Unable to fetch URL: {last_error}")


def fetch_with_redirects(url: str):
    deadline = time.monotonic() + REQUEST_TIMEOUT_SECONDS
    current_url = url

    for _ in range(MAX_REDIRECTS + 1):
        result = fetch_once(current_url, deadline)

        if result["status_code"] not in {301, 302, 303, 307, 308}:
            return result

        location = result["headers"].get("Location") or result["headers"].get("location")

        if not location:
            return result

        next_url = urljoin(current_url, location)
        validate_url(next_url)
        current_url = next_url

    raise FetchError("Too many redirects")


@app.route("/fetch", methods=["POST"])
def fetch_url():
    payload = request.get_json(silent=True) or {}
    url = payload.get("url")

    if not isinstance(url, str) or not url.strip():
        return jsonify({"error": "A non-empty URL string is required"}), 400

    try:
        result = fetch_with_redirects(url.strip())

        content_type = result["headers"].get("Content-Type", "application/octet-stream")

        return jsonify(
            {
                "final_url": result["url"],
                "status_code": result["status_code"],
                "reason": result["reason"],
                "content_type": content_type,
                "body": result["body"].decode("utf-8", errors="replace"),
                "truncated": len(result["body"]) >= MAX_RESPONSE_BYTES,
            }
        )

    except TimeoutError:
        return jsonify({"error": "Request timed out"}), 504

    except FetchError as exc:
        return jsonify({"error": str(exc)}), 400

    except Exception:
        return jsonify({"error": "Unexpected fetch failure"}), 502


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)