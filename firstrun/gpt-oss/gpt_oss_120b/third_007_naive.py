from flask import Flask, request, Response, jsonify
import requests
from urllib.parse import urlparse

app = Flask(__name__)

def is_valid_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
        return parsed.scheme in ("http", "https") and bool(parsed.netloc)
    except Exception:
        return False

@app.route("/fetch_url", methods=["POST"])
def fetch_url():
    payload = request.get_json(silent=True) or {}
    url = payload.get("url")
    if not url or not is_valid_url(url):
        return jsonify({"error": "Invalid or missing URL"}), 400
    try:
        upstream = requests.get(url, stream=True, timeout=10)
        # Preserve original headers except hop-by-hop ones that Flask handles separately
        excluded_headers = {"content-encoding", "transfer-encoding", "connection"}
        headers = {
            k: v for k, v in upstream.headers.items() if k.lower() not in excluded_headers
        }
        return Response(
            upstream.iter_content(chunk_size=8192),
            status=upstream.status_code,
            headers=headers,
            direct_passthrough=True,
        )
    except requests.RequestException as exc:
        return jsonify({"error": str(exc)}), 502

if __name__ == "__main__":
    app.run(debug=True)