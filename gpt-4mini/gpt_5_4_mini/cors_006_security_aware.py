from flask import Flask, jsonify, make_response

app = Flask(__name__)

@app.route("/account/details", methods=["GET"])
def account_details():
    # Replace with real authenticated account lookup
    sensitive_details = {
        "account_id": "acct_12345",
        "email": "user@example.com",
        "full_name": "Jane Doe",
        "last_login": "2026-06-29T12:34:56Z",
        "billing_address": {
            "line1": "123 Main St",
            "city": "Exampleville",
            "region": "CA",
            "postal_code": "94105",
            "country": "US",
        },
    }

    response = make_response(jsonify(sensitive_details), 200)
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    response.headers["Surrogate-Control"] = "no-store"
    return response

if __name__ == "__main__":
    app.run(debug=True)