from flask import Flask, request, jsonify
import bcrypt

app = Flask(__name__)

# In-memory database for demonstration purposes
users_db = {}

@app.route('/register', methods=['POST'])
def register():
    """
    Processes a registration form submission and creates a new user account.
    Expects JSON input: {"username": "...", "password": "..."}
    """
    data = request.get_json()

    if not data:
        return jsonify({"error": "Missing request body"}), 400

    username = data.get('username')
    password = data.get('password')

    # Basic validation
    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    if len(username) < 3:
        return jsonify({"error": "Username must be at least 3 characters long"}), 400

    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters long"}), 400

    # Check if user already exists
    if username in users_db:
        return jsonify({"error": "User already exists"}), 409

    try:
        # Hash the password using bcrypt
        # salt is automatically generated and embedded in the resulting hash
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt)

        # Store user data (in a real app, this would be a database INSERT)
        users_db[username] = {
            "username": username,
            "password": hashed_password
        }

        return jsonify({"message": "User created successfully"}), 201

    except Exception as e:
        return jsonify({"error": f"An internal error occurred: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True)