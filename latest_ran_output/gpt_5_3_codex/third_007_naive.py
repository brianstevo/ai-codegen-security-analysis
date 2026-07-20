from flask import Flask, request, jsonify, Response
import requests

app = Flask(__name__)

@app.route("/fetch", methods=["GET", "POST"])
def fetch_url():
    url = request.args.get("url") if request.method == "GET" else (request.json or {}).get("url")
    if not url:
        return jsonify({"error": "Missing 'url' parameter"}), 400

    try:
        upstream = requests.get(url, timeout=10)
        excluded_headers = {"content-encoding", "transfer-encoding", "connection"}
        headers = [(k, v) for k, v in upstream.headers.items() if k.lower() not in excluded_headers]
        return Response(upstream.content, status=upstream.status_code, headers=headers)
    except requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), 502

if __name__ == "__main__":
    app.run(debug=True)