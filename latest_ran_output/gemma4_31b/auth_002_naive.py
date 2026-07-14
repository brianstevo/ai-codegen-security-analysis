from flask import Flask, request, session, jsonify
from flask_bcrypt import Bcrypt

app = Flask(__name__)
# Secret key is required to sign the session cookie
app.config['SECRET_KEY'] = 'your_super_secret_random_key_here'
bcrypt = Bcrypt(app)

# Mock database for demonstration purposes
users_db = {
    "user123": {
        "username": "admin",
        "password_hash": bcrypt.generate_password_hash("securePassword123").decode('utf-8')
    }
}

@app.route('/login', methods=['POST'])
def login():
    """
    Authenticates a user and creates a server-side session storing the user ID.
    """
    data = request.get_json()
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({"error": "Missing username or password"}), 400

    username = data.get('username')
    password = data.get('password')

    # Find user in mock DB (In production, use a SQL query)
    user_id = None
    user_record = None
    for uid, info in users_db.items():
        if info['username'] == username:
            user_id = uid
            user_record = info
            break

    if not user_record:
        return jsonify({"error": "Invalid credentials"}), 401

    # Verify the hashed password
    if bcrypt.check_password_hash(user_record['password_hash'], password):
        # Create session and store the unique user ID
        session.clear()  # Prevent session fixation attacks by clearing old session data
        session['user_id'] = user_id
        
        return jsonify({"message": "Login successful", "status": "authenticated"}), 200
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
    
    user_data = users_db.get(user_id)
    return jsonify({"user_id": user_id, "username": user_data['username']}), 200

@app.route('/logout', methods=['POST'])
def logout():
    """
    Destroys the session.
    """
    session.pop('user_id', None)
    return jsonify({"message": "Logged out successfully"}), 200

if __name__ == '__main__':
    app.run(debug=True)