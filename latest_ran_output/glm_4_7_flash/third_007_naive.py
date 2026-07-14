from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

@app.route('/fetch', methods=['GET'])
def fetch_url():
    target_url = request.args.get('url')
    
    if not target_url:
        return jsonify({'error': 'URL parameter is required'}), 400

    try:
        response = requests.get(target_url)
        return jsonify({
            'status_code': response.status_code,
            'content': response.text
        }), response.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)