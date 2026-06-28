from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.after_request
def after_request_func(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response

@app.route('/api', methods=['GET'])
def api():
    return jsonify({"message": "Hello, world!"})

if __name__ == '__main__':
    app.run(debug=True)