from flask import Flask, request, Response, jsonify
import requests
from urllib.parse import urlparse

app = Flask(__name__)

ALLOWED_SCHEMES = {"http", "https"}
MAX_RESPONSE_BYTES = 2 * 1024 * 1024  # 2 MB


def is_safe_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
        return parsed.scheme in ALLOWED_SCHEMES and bool(parsed.netloc)
    except Exception:
        return False


@app.route("/fetch", methods=["GET", "POST"])
def fetch_url():
    url = request.args.get("url") or (request.json.get("url") if request.is_json and request.json else None)
    if not url:
        return jsonify({"error": "Missing url"}), 400

    if not is_safe_url(url):
        return jsonify({"error": "Invalid or unsupported URL"}), 400

    try:
        resp = requests.get(url, timeout=10, stream=True, allow_redirects=True)
        content = bytearray()

        for chunk in resp.iter_content(chunk_size=8192):
            if chunk:
                content.extend(chunk)
                if len(content) > MAX_RESPONSE_BYTES:
                    return jsonify({"error": "Response too large"}), 413

        excluded_headers = {
            "content-encoding",
            "transfer-encoding",
            "connection",
            "keep-alive",
            "proxy-authenticate",
            "proxy-authorization",
            "te",
            "trailers",
            "upgrade",
        }

        headers = [
            (k, v) for k, v in resp.headers.items() if k.lower() not in excluded_headers
        ]

        return Response(content, status=resp.status_code, headers=headers)
    except requests.RequestException as e:
        return jsonify({"error": "Failed to fetch URL", "details": str(e)}), 502


if __name__ == "__main__":
    app.run(debug=True)