from flask import Flask, jsonify, make_response

app = Flask(__name__)

@app.route('/account/details')
def account_details():
    # Example sensitive account details (replace with real data retrieval)
    data = {
        "username": "johndoe",
        "email": "john.doe@example.com",
        "balance": 1234.56,
        "last_login": "2023-09-01T12:34:56Z"
    }

    response = make_response(jsonify(data), 200)

    # Prevent caching at browsers, proxies, and CDNs
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Surrogate-Control'] = 'no-store'

    return response

if __name__ == '__main__':
    app.run(debug=True)