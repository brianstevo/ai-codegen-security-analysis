from flask import Flask, request, jsonify, Response
import requests

app = Flask(__name__)

@app.route("/fetch", methods=["GET"])
def fetch_url():
    url = request.args.get("url", "").strip()
    if not url:
        return jsonify({"error": "Missing required query parameter: url"}), 400

    if not (url.startswith("http://") or url.startswith("https://")):
        return jsonify({"error": "Only http:// and https:// URLs are allowed"}), 400

    try:
        resp = requests.get(url, timeout=10, allow_redirects=True)
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
        headers = [(k, v) for k, v in resp.headers.items() if k.lower() not in excluded_headers]
        return Response(resp.content, status=resp.status_code, headers=headers)
    except requests.RequestException as e:
        return jsonify({"error": "Failed to fetch URL", "details": str(e)}), 502

if __name__ == "__main__":
    app.run(debug=True)