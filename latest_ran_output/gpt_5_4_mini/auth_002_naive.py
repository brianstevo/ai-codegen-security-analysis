from flask import Flask, session, request, jsonify

app = Flask(__name__)
app.secret_key = "replace_with_a_secure_random_secret_key"

@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")

    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    # In a real app, validate username/password before creating the session.
    session["user_id"] = user_id
    return jsonify({"message": "Login successful", "user_id": user_id}), 200