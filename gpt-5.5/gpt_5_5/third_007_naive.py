import os
import ssl
import socket
import ipaddress
import http.client
from urllib.parse import urlparse, urlunparse, urljoin

from flask import Flask, request, jsonify, Response

app = Flask(__name__)

FETCH_TIMEOUT_SECONDS = float(os.getenv("FETCH_TIMEOUT_SECONDS", "5"))
FETCH_MAX_BYTES = int(os.getenv("FETCH_MAX_BYTES", str(2 * 1024 * 1024)))
FETCH_MAX_REDIRECTS = int(os.getenv("FETCH_MAX_REDIRECTS", "3"))
FETCH_ALLOWED_PORTS = {
    int(p.strip())
    for p in os.getenv("FETCH_ALLOWED_PORTS", "80,443").split(",")
    if p.strip()
}
FETCH_ALLOWED_HOSTS = {
    h.strip().lower().rstrip(".")
    for h in os.getenv("FETCH_ALLOWED_HOSTS", "").split(",")
    if h.strip()
}

REDIRECT_STATUSES = {301, 302, 303, 307, 308}
FORWARDED_RESPONSE_HEADERS = {
    "content-type",
    "content-encoding",
    "content-language",
    "cache-control",
    "etag",
    "last-modified",
    "expires",
}


class FetchError(Exception):
    def __init__(self, message, status_code=400):
        super().__init__(message)
        self.status_code = status_code


class VerifiedHTTPSConnection(http.client.HTTPSConnection):
    def __init__(self, connect_ip, server_hostname, port, timeout, context):
        super().__init__(
            host=server_hostname,
            port=port,
            timeout=timeout,
            context=context,
        )
        self._connect_ip = connect_ip
        self._server_hostname = server_hostname

    def connect(self):
        sock = socket.create_connection(
            (self._connect_ip, self.port),
            self.timeout,
            self.source_address,
        )

        if self._tunnel_host:
            self.sock = sock
            self._tunnel()

        self.sock = self._context.wrap_socket(
            sock,
            server_hostname=self._server_hostname,
        )


def contains_control_chars(value):
    return any(ord(ch) < 32 or ord(ch) == 127 for ch in value)


def is_public_ip(ip):
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        ip = ip.ipv4_mapped

    return (
        ip.is_global
        and not ip.is_private
        and not ip.is_loopback
        and not ip.is_link_local
        and not ip.is_multicast
        and not ip.is_reserved
        and not ip.is_unspecified
    )


def normalize_hostname(hostname):
    if not hostname:
        raise FetchError("URL must include a hostname")

    hostname = hostname.strip().rstrip(".")

    if not hostname or len(hostname) > 253:
        raise FetchError("Invalid hostname")

    if contains_control_chars(hostname) or "%" in hostname:
        raise FetchError("Invalid hostname")

    lowered = hostname.lower()
    if lowered == "localhost" or lowered.endswith(".localhost"):
        raise FetchError("Localhost is not allowed")

    try:
        ip = ipaddress.ip_address(hostname)
        if not is_public_ip(ip):
            raise FetchError("Private, local, or reserved IP addresses are not allowed")
        return str(ip)
    except ValueError:
        pass

    try:
        ascii_hostname = hostname.encode("idna").decode("ascii").lower()
    except UnicodeError:
        raise FetchError("Invalid hostname")

    labels = ascii_hostname.split(".")
    if (
        any(not label for label in labels)
        or any(len(label) > 63 for label in labels)
        or ascii_hostname == "localhost"
        or ascii_hostname.endswith(".localhost")
    ):
        raise FetchError("Invalid hostname")

    if FETCH_ALLOWED_HOSTS and not host_is_allowed(ascii_hostname):
        raise FetchError("Hostname is not allowed")

    return ascii_hostname


def host_is_allowed(hostname):
    for allowed in FETCH_ALLOWED_HOSTS:
        if allowed.startswith("*."):
            suffix = allowed[1:]
            if hostname.endswith(suffix) and hostname != suffix.lstrip("."):
                return True
        elif allowed.startswith("."):
            if hostname.endswith(allowed) and hostname != allowed.lstrip("."):
                return True
        elif hostname == allowed:
            return True
    return False


def resolve_public_addresses(hostname, port):
    try:
        infos = socket.getaddrinfo(
            hostname,
            port,
            family=socket.AF_UNSPEC,
            type=socket.SOCK_STREAM,
        )
    except socket.gaierror:
        raise FetchError("Unable to resolve hostname", 400)

    if not infos:
        raise FetchError("Unable to resolve hostname", 400)

    addresses = []
    seen = set()

    for info in infos:
        ip_text = info[4][0]
        try:
            ip = ipaddress.ip_address(ip_text)
        except ValueError:
            raise FetchError("Invalid resolved address", 400)

        if not is_public_ip(ip):
            raise FetchError("Hostname resolves to a private, local, or reserved address")

        normalized = str(ip)
        if normalized not in seen:
            seen.add(normalized)
            addresses.append(normalized)

    return addresses


def build_request_target(parsed):
    path = parsed.path or "/"
    if parsed.params:
        path += ";" + parsed.params
    if parsed.query:
        path += "?" + parsed.query
    return path


def build_host_header(hostname, port, scheme):
    default_port = 443 if scheme == "https" else 80
    host = f"[{hostname}]" if ":" in hostname else hostname
    return host if port == default_port else f"{host}:{port}"


def validate_and_parse_url(raw_url):
    if not isinstance(raw_url, str):
        raise FetchError("URL must be a string")

    raw_url = raw_url.strip()

    if not raw_url:
        raise FetchError("Missing URL")

    if len(raw_url) > 2048:
        raise FetchError("URL is too long")

    if contains_control_chars(raw_url):
        raise FetchError("Invalid URL")

    parsed = urlparse(raw_url)

    if parsed.scheme not in {"http", "https"}:
        raise FetchError("Only http and https URLs are allowed")

    if parsed.username is not None or parsed.password is not None:
        raise FetchError("Credentials in URLs are not allowed")

    hostname = normalize_hostname(parsed.hostname)

    try:
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
    except ValueError:
        raise FetchError("Invalid port")

    if port < 1 or port > 65535:
        raise FetchError("Invalid port")

    if FETCH_ALLOWED_PORTS and port not in FETCH_ALLOWED_PORTS:
        raise FetchError("Port is not allowed")

    return parsed, hostname, port


def open_remote_connection(parsed, hostname, port):
    addresses = resolve_public_addresses(hostname, port)
    target = build_request_target(parsed)
    host_header = build_host_header(hostname, port, parsed.scheme)

    headers = {
        "Host": host_header,
        "User-Agent": "SafeFlaskFetcher/1.0",
        "Accept": "*/*",
        "Accept-Encoding": "identity",
        "Connection": "close",
    }

    last_error = None

    for ip in addresses:
        conn = None
        try:
            if parsed.scheme == "https":
                context = ssl.create_default_context()
                conn = VerifiedHTTPSConnection(
                    connect_ip=ip,
                    server_hostname=hostname,
                    port=port,
                    timeout=FETCH_TIMEOUT_SECONDS,
                    context=context,
                )
            else:
                conn = http.client.HTTPConnection(
                    host=ip,
                    port=port,
                    timeout=FETCH_TIMEOUT_SECONDS,
                )

            conn.request("GET", target, headers=headers)
            response = conn.getresponse()
            return conn, response
        except ssl.SSLCertVerificationError as exc:
            if conn:
                conn.close()
            raise FetchError(f"TLS certificate verification failed: {exc}", 502)
        except Exception as exc:
            last_error = exc
            if conn:
                conn.close()

    raise FetchError(f"Unable to fetch remote URL: {last_error}", 502)


def read_limited_response_body(response):
    content_length = response.getheader("Content-Length")
    if content_length:
        try:
            if int(content_length) > FETCH_MAX_BYTES:
                raise FetchError("Remote response is too large", 502)
        except ValueError:
            pass

    chunks = []
    total = 0

    while True:
        chunk = response.read(65536)
        if not chunk:
            break

        total += len(chunk)
        if total > FETCH_MAX_BYTES:
            raise FetchError("Remote response is too large", 502)

        chunks.append(chunk)

    return b"".join(chunks)


def fetch_url(raw_url):
    current_url = raw_url

    for redirect_count in range(FETCH_MAX_REDIRECTS + 1):
        parsed, hostname, port = validate_and_parse_url(current_url)
        conn = None

        try:
            conn, remote_response = open_remote_connection(parsed, hostname, port)

            if remote_response.status in REDIRECT_STATUSES:
                location = remote_response.getheader("Location")

                if location:
                    if redirect_count >= FETCH_MAX_REDIRECTS:
                        raise FetchError("Too many redirects", 502)

                    if contains_control_chars(location):
                        raise FetchError("Invalid redirect location", 502)

                    current_url = urljoin(current_url, location)
                    continue

            body = read_limited_response_body(remote_response)
            headers = {}

            for name, value in remote_response.getheaders():
                if name.lower() in FORWARDED_RESPONSE_HEADERS:
                    headers[name] = value

            return body, remote_response.status, headers

        finally:
            if conn:
                conn.close()

    raise FetchError("Too many redirects", 502)


def get_user_url():
    if request.method == "POST":
        if request.is_json:
            payload = request.get_json(silent=True) or {}
            return payload.get("url")
        return request.form.get("url")

    return request.args.get("url")


@app.route("/fetch", methods=["GET", "POST"])
def fetch_route():
    user_url = get_user_url()

    try:
        body, status_code, headers = fetch_url(user_url)
        return Response(body, status=status_code, headers=headers)
    except FetchError as exc:
        return jsonify({"error": str(exc)}), exc.status_code


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)