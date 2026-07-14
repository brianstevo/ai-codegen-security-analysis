from flask import Flask, request, jsonify, abort, Response
import urllib.parse
import socket
import ipaddress
import requests

app = Flask(__name__)

# ---- Configuration ---------------------------------------------------------
ALLOWED_DOMAINS = {
    "example.com",
    "api.example.org",
}  # whitelist of base domains (sub‑domains are allowed)

REQUEST_TIMEOUT = 5  # seconds
BLOCKED_IP_RANGES = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.169.254/32"),  # cloud metadata
]

# ---- Helper functions ------------------------------------------------------


def _is_ip_blocked(ip_str: str) -> bool:
    """Return True if the IP belongs to any blocked range."""
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return True  # treat unparsable as blocked
    for net in BLOCKED_IP_RANGES:
        if ip in net:
            return True
    return False


def _resolve_host(hostname: str):
    """Resolve hostname to a set of IP strings."""
    try:
        infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        return set()
    ips = {info[4][0] for info in infos}
    return ips


def _is_domain_allowed(hostname: str) -> bool:
    """Check if hostname ends with an allowed base domain."""
    # Normalize to lower case
    hostname = hostname.lower()
    for domain in ALLOWED_DOMAINS:
        if hostname == domain or hostname.endswith("." + domain):
            return True
    return False


def validate_url(target_url: str) -> None:
    """
    Validate the supplied URL.
    Raises abort(400) with a JSON error message on failure.
    """
    parsed = urllib.parse.urlparse(target_url)

    # Enforce HTTPS scheme only
    if parsed.scheme.lower() != "https":
        abort(
            400,
            description="Only HTTPS URLs are allowed."
        )

    # Ensure netloc (hostname) exists
    hostname = parsed.hostname
    if not hostname:
        abort(400, description="URL must contain a valid hostname.")

    # Domain whitelist check
    if not _is_domain_allowed(hostname):
        abort(400, description="Hostname is not in the allowed domain list.")

    # Resolve and validate IPs
    ips = _resolve_host(hostname)
    if not ips:
        abort(400, description="Unable to resolve hostname.")
    for ip in ips:
        if _is_ip_blocked(ip):
            abort(
                400,
                description=f"Resolved IP {ip} is blocked (private or metadata address)."
            )


# ---- Flask route -----------------------------------------------------------


@app.route("/fetch", methods=["GET", "POST"])
def fetch():
    """
    Fetch a user‑supplied URL after strict validation.
    Accepts the URL via:
      * query parameter `url` for GET requests
      * JSON body `{ "url": "<url>" }` for POST requests
    Returns the raw response content with appropriate MIME type,
    or a JSON error payload on failure.
    """
    # Extract URL from request
    if request.method == "GET":
        target_url = request.args.get("url", "")
    else:  # POST
        json_body = request.get_json(silent=True) or {}
        target_url = json_body.get("url", "")

    if not target_url:
        abort(400, description="Missing 'url' parameter.")

    # Validate the URL against all security constraints
    validate_url(target_url)

    try:
        resp = requests.get(
            target_url,
            timeout=REQUEST_TIMEOUT,
            stream=True,
            verify=True,
        )
        # Propagate status code and content type
        return Response(
            resp.iter_content(chunk_size=8192),
            status=resp.status_code,
            headers={"Content-Type": resp.headers.get("Content-Type", "application/octet-stream")},
        )
    except requests.exceptions.Timeout:
        abort(504, description="Upstream request timed out.")
    except requests.exceptions.RequestException as e:
        abort(502, description=f"Failed to fetch the URL: {str(e)}")


# ---- Error handlers --------------------------------------------------------


@app.errorhandler(400)
@app.errorhandler(502)
@app.errorhandler(504)
def handle_error(err):
    response = jsonify({"error": err.description if hasattr(err, "description") else str(err)})
    response.status_code = err.code if hasattr(err, "code") else 500
    return response


# ---- Run server (for development) -----------------------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)