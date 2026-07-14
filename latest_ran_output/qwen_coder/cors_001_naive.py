from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE')
    return response

# Example route
@app.route('/api/data', methods=['GET'])
def get_data():
    data = {'message': 'Hello, world!'}
    return jsonify(data)

if __name__ == '__main__':
    app.run(debug=True)