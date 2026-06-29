import re
import requests
from flask import Flask, jsonify, request

app = Flask(__name__)

ALLOWED_SCHEMES = {"http", "https"}
BLOCKED_HOSTS = {
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "::1",
}

# Block private/internal IP ranges
PRIVATE_IP_PATTERNS = [
    re.compile(r"^10\."),
    re.compile(r"^172\.(1[6-9]|2[0-9]|3[0-1])\."),
    re.compile(r"^192\.168\."),
    re.compile(r"^169\.254\."),  # link-local
    re.compile(r"^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\."),  # shared address space
]

MAX_RESPONSE_SIZE = 5 * 1024 * 1024  # 5 MB
REQUEST_TIMEOUT = 10  # seconds


def is_safe_url(url: str) -> tuple[bool, str]:
    """Validate the URL to prevent SSRF and other attacks."""
    from urllib.parse import urlparse
    import socket

    try:
        parsed = urlparse(url)
    except Exception:
        return False, "Invalid URL format."

    if parsed.scheme not in ALLOWED_SCHEMES:
        return False, f"URL scheme '{parsed.scheme}' is not allowed. Use http or https."

    hostname = parsed.hostname
    if not hostname:
        return False, "Could not determine hostname from URL."

    if hostname.lower() in BLOCKED_HOSTS:
        return False, f"Access to host '{hostname}' is not allowed."

    # Resolve hostname to IP and check against private ranges
    try:
        resolved_ip = socket.gethostbyname(hostname)
    except socket.gaierror:
        return False, f"Could not resolve hostname '{hostname}'."

    if resolved_ip in BLOCKED_HOSTS:
        return False, f"Access to IP '{resolved_ip}' is not allowed."

    for pattern in PRIVATE_IP_PATTERNS:
        if pattern.match(resolved_ip):
            return False, f"Access to private IP range '{resolved_ip}' is not allowed."

    return True, ""


@app.route("/fetch", methods=["POST"])
def fetch_url():
    """
    Fetch a URL provided by the user and return the response.

    Expected JSON body:
        {
            "url": "https://example.com"
        }

    Returns:
        JSON with status_code, headers, and body (text content).
    """
    data = request.get_json(silent=True)

    if not data or "url" not in data:
        return jsonify({"error": "Missing 'url' field in request body."}), 400

    url = data["url"]

    if not isinstance(url, str) or not url.strip():
        return jsonify({"error": "'url' must be a non-empty string."}), 400

    url = url.strip()

    safe, reason = is_safe_url(url)
    if not safe:
        return jsonify({"error": reason}), 400

    try:
        response = requests.get(
            url,
            timeout=REQUEST_TIMEOUT,
            allow_redirects=True,
            stream=True,
            headers={
                "User-Agent": "FlaskFetchBot/1.0",
            },
        )

        # Enforce response size limit
        content = b""
        for chunk in response.iter_content(chunk_size=8192):
            content += chunk
            if len(content) > MAX_RESPONSE_SIZE:
                return (
                    jsonify(
                        {
                            "error": f"Response exceeds maximum allowed size of {MAX_RESPONSE_SIZE} bytes."
                        }
                    ),
                    502,
                )

        # Attempt to decode response as text
        try:
            body = content.decode(response.encoding or "utf-8", errors="replace")
        except (UnicodeDecodeError, LookupError):
            body = content.decode("utf-8", errors="replace")

        # Filter response headers to return only safe/relevant ones
        safe_headers = {
            k: v
            for k, v in response.headers.items()
            if k.lower()
            in {
                "content-type",
                "content-length",
                "last-modified",
                "etag",
                "server",
                "date",
            }
        }

        return (
            jsonify(
                {
                    "status_code": response.status_code,
                    "url": response.url,
                    "headers": safe_headers,
                    "body": body,
                }
            ),
            200,
        )

    except requests.exceptions.SSLError as e:
        return jsonify({"error": f"SSL error while fetching URL: {str(e)}"}), 502
    except requests.exceptions.ConnectionError as e:
        return jsonify({"error": f"Connection error while fetching URL: {str(e)}"}), 502
    except requests.exceptions.Timeout:
        return (
            jsonify({"error": f"Request timed out after {REQUEST_TIMEOUT} seconds."}),
            504,
        )
    except requests.exceptions.TooManyRedirects:
        return jsonify({"error": "Too many redirects while fetching URL."}), 502
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"An error occurred while fetching URL: {str(e)}"}), 502


if __name__ == "__main__":
    app.run(debug=False)