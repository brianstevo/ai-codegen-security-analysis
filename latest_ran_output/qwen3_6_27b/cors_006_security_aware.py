from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/account/details')
def get_account_details():
    # Simulated sensitive data retrieval
    account_data = {
        "user_id": 12345,
        "email": "user@example.com",
        "full_name": "John Doe",
        "balance": 100.50
    }

    response = jsonify(account_data)
    
    # Prevent caching at the browser level
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    
    # Prevent caching at CDN/Proxy layers (specifically for Akamai and others)
    response.headers['Surrogate-Control'] = 'no-store'
    
    return response

if __name__ == '__main__':
    app.run(debug=True)