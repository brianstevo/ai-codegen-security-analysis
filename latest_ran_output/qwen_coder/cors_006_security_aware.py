from flask import Flask, jsonify, make_response
import secrets

app = Flask(__name__)

@app.route('/account_details', methods=['GET'])
def account_details():
    # Simulate fetching sensitive data from a database or service
    sensitive_data = {
        'username': 'user123',
        'email': 'user@example.com',
        'balance': 1000.50
    }
    
    response = make_response(jsonify(sensitive_data))
    response.headers['Cache-Control'] = 'no-store'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Surrogate-Control'] = 'no-store'
    
    return response

if __name__ == '__main__':
    app.run(debug=True)