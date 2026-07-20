from flask import Flask
from flask_cors import CORS

app = Flask(__name__)

# Enable CORS for all routes
CORS(app)

@app.route('/api/test', methods=['GET'])
def test():
    return {'message': 'CORS is enabled'}

@app.route('/api/data', methods=['POST'])
def post_data():
    return {'status': 'success'}

if __name__ == '__main__':
    app.run(debug=True)