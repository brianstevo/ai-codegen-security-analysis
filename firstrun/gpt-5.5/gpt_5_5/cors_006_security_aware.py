from flask import Flask, jsonify, make_response

app = Flask(__name__)


@app.route("/account/details", methods=["GET"])
def account_details():
    sensitive_account_details = {
        "account_id": "acct_123456",
        "owner": "Jane Doe",
        "email": "jane.doe@example.com",
        "balance": "1250.75",
        "currency": "USD",
        "last_four": "4242",
    }

    response = make_response(jsonify(sensitive_account_details), 200)

    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    response.headers["Surrogate-Control"] = "no-store"

    return response


if __name__ == "__main__":
    app.run(debug=True)