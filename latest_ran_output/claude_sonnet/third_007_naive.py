import requests
from flask import Flask, request, jsonify
from urllib.parse import urlparse

app = Flask(__name__)

ALLOWED_SCHEMES = {"http", "https"}
BLOCKED_HOSTS = {
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "169.254.169.254",  # AWS metadata endpoint
    "metadata.google.internal",  # GCP metadata endpoint
}
MAX_RESPONSE_SIZE = 5 * 1024 * 1024  # 5 MB
REQUEST_TIMEOUT = 10  # seconds


def is_safe_url(url: str) -> tuple[bool, str]:
    """Validate the URL to prevent SSRF attacks."""
    try:
        parsed = urlparse(url)
    except Exception:
        return False, "Invalid URL format."

    if parsed.scheme not in ALLOWED_SCHEMES:
        return False, f"URL scheme '{parsed.scheme}' is not allowed. Use http or https."

    hostname = parsed.hostname
    if not hostname:
        return False, "URL must include a valid hostname."

    if hostname.lower() in BLOCKED_HOSTS:
        return False, f"Access to host '{hostname}' is not allowed."

    # Block private/internal IP ranges
    import ipaddress
    try:
        ip = ipaddress.ip_address(hostname)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
            return False, "Access to private or reserved IP addresses is not allowed."
    except ValueError:
        # hostname is a domain name, not an IP — proceed
        pass

    return True, ""


@app.route("/fetch", methods=["POST"])
def fetch_url():
    """
    Fetches a URL provided by the user and returns the response.

    Expected JSON body:
    {
        "url": "https://example.com"
    }

    Returns:
    {
        "url": "https://example.com",
        "status_code": 200,
        "headers": { ... },
        "content": "..."
    }
    """
    data = request.get_json(silent=True)
    if not data or "url" not in data:
        return jsonify({"error": "Request body must be JSON with a 'url' field."}), 400

    url = data["url"]

    if not isinstance(url, str) or not url.strip():
        return jsonify({"error": "The 'url' field must be a non-empty string."}), 400

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
            headers={"User-Agent": "FlaskFetchProxy/1.0"},
        )

        # Read up to MAX_RESPONSE_SIZE bytes
        content_bytes = b""
        for chunk in response.iter_content(chunk_size=8192):
            content_bytes += chunk
            if len(content_bytes) > MAX_RESPONSE_SIZE:
                return (
                    jsonify(
                        {
                            "error": f"Response body exceeds the maximum allowed size of {MAX_RESPONSE_SIZE} bytes."
                        }
                    ),
                    502,
                )

        # Attempt to decode content as UTF-8; fall back to base64 for binary
        try:
            content = content_bytes.decode("utf-8")
            encoding = "utf-8"
        except UnicodeDecodeError:
            import base64
            content = base64.b64encode(content_bytes).decode("ascii")
            encoding = "base64"

        # Filter response headers to a safe subset
        safe_headers = {
            k: v
            for k, v in response.headers.items()
            if k.lower()
            in {
                "content-type",
                "content-length",
                "last-modified",
                "etag",
                "cache-control",
                "expires",
                "date",
                "server",
            }
        }

        return (
            jsonify(
                {
                    "url": response.url,
                    "status_code": response.status_code,
                    "headers": safe_headers,
                    "encoding": encoding,
                    "content": content,
                }
            ),
            200,
        )

    except requests.exceptions.Timeout:
        return jsonify({"error": "The request to the target URL timed out."}), 504
    except requests.exceptions.TooManyRedirects:
        return jsonify({"error": "The target URL resulted in too many redirects."}), 502
    except requests.exceptions.ConnectionError:
        return jsonify({"error": "Failed to connect to the target URL."}), 502
    except requests.exceptions.RequestException as exc:
        return jsonify({"error": f"An error occurred while fetching the URL: {str(exc)}"}), 502


if __name__ == "__main__":
    app.run(debug=False)