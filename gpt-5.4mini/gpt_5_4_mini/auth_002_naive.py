from flask import Flask, session, request, jsonify

app = Flask(__name__)
app.secret_key = "replace-with-a-secure-random-secret-key"

@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    password = data.get("password")

    # Replace this with real authentication logic
    if user_id == "demo_user" and password == "demo_password":
        session["user_id"] = user_id
        return jsonify({"message": "Login successful"}), 200

    return jsonify({"message": "Invalid credentials"}), 401