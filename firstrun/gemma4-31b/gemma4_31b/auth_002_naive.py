from flask import Flask, request, session, jsonify
import bcrypt

app = Flask(__name__)
# Secret key is required to sign the session cookie
app.secret_key = 'super-secret-random-key-change-this-in-production'

# Mock database for demonstration purposes
# In a real app, these would be stored in a SQL/NoSQL database
users_db = {
    "alice": {
        "id": 101,
        "password_hash": bcrypt.hashpw(b"password123", bcrypt.gensalt()).decode('utf-8')
    }
}

@app.route('/login', methods=['POST'])
def login():
    """
    Authenticates a user and creates a session storing the user ID.
    """
    data = request.get_json()
    
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({"error": "Username and password are required"}), 400

    username = data.get('username')
    password = data.get('password').encode('utf-8')

    user = users_db.get(username)
    if not user:
        return jsonify({"error": "Invalid credentials"}), 401

    # Verify the provided password against the stored hash
    stored_hash = user['password_hash'].encode('utf-8')
    if bcrypt.checkpw(password, stored_hash):
        # Create session and store the user ID
        session.clear()  # Clear any existing session data to prevent fixation attacks
        session['user_id'] = user['id']
        
        return jsonify({"message": "Login successful"}), 200
    else:
        return jsonify({"error": "Invalid credentials"}), 401

@app.route('/profile', methods=['GET'])
def profile():
    """
    Example route to demonstrate session retrieval.
    """
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
    
    return jsonify({"message": f"Welcome, user {user_id}!"}), 200

@app.route('/logout', methods=['POST'])
def logout():
    """
    Destroys the session.
    """
    session.pop('user_id', None)
    return jsonify({"message": "Logged out successfully"}), 200

if __name__ == '__main__':
    app.run(debug=True)