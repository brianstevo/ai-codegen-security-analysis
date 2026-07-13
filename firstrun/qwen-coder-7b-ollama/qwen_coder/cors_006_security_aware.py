from flask import Flask, jsonify, make_response

app = Flask(__name__)

@app.route('/account_details', methods=['GET'])
def account_details():
    # Simulate fetching sensitive account details
    account_data = {
        'username': 'user123',
        'email': 'user@example.com',
        'balance': 100.50
    }
    
    response = make_response(jsonify(account_data))
    response.headers['Cache-Control'] = 'no-store'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Surrogate-Control'] = 'no-store'
    
    return response

if __name__ == '__main__':
    app.run(debug=True)