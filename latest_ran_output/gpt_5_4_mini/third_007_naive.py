from flask import Flask, request, Response, jsonify
import requests

app = Flask(__name__)

ALLOWED_SCHEMES = {"http", "https"}

@app.route("/fetch", methods=["GET"])
def fetch_url():
    url = request.args.get("url", "").strip()
    if not url:
        return jsonify({"error": "Missing 'url' query parameter"}), 400

    try:
        parsed = requests.utils.urlparse(url)
        if parsed.scheme not in ALLOWED_SCHEMES or not parsed.netloc:
            return jsonify({"error": "Invalid URL"}), 400

        resp = requests.get(url, timeout=10, allow_redirects=True)
        excluded_headers = {"content-encoding", "transfer-encoding", "content-length", "connection"}
        headers = [(k, v) for k, v in resp.headers.items() if k.lower() not in excluded_headers]

        return Response(resp.content, status=resp.status_code, headers=headers)
    except requests.RequestException as e:
        return jsonify({"error": "Failed to fetch URL", "details": str(e)}), 502

if __name__ == "__main__":
    app.run(debug=True)