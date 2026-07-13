from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

@app.route('/fetch_url', methods=['GET'])
def fetch_url():
    url = request.args.get('url')
    if not url:
        return jsonify({'error': 'URL parameter is required'}), 400
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        return jsonify({'content': response.text})
    except requests.RequestException as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)