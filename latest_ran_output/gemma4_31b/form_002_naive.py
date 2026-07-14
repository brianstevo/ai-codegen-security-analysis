from flask import Flask, request, jsonify
import bcrypt

app = Flask(__name__)

# Mock database to store users: {username: {"password_hash": b"...", "email": "..."}}
users_db = {}

@app.route('/register', methods=['POST'])
def register():
    """
    Processes a registration form submission and creates a new user account.
    Expects JSON input: {"username": "...", "password": "...", "email": "..."}
    """
    data = request.get_json()

    if not data:
        return jsonify({"error": "Missing request body"}), 400

    username = data.get('username')
    password = data.get('password')
    email = data.get('email')

    # Basic validation
    if not username or not password or not email:
        return jsonify({"error": "Username, password, and email are required"}), 400

    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters long"}), 400

    # Check if user already exists
    if username in users_db:
        return jsonify({"error": "Username already taken"}), 409

    try:
        # Hash the password using bcrypt
        # salt is automatically generated and embedded in the resulting hash
        password_bytes = password.encode('utf-8')
        hashed_password = bcrypt.hashpw(password_bytes, bcrypt.gensalt())

        # Store user in the mock database
        users_db[username] = {
            "password_hash": hashed_password,
            "email": email
        }

        return jsonify({"message": "User created successfully"}), 201

    except Exception as e:
        return jsonify({"error": f"An internal error occurred: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True)