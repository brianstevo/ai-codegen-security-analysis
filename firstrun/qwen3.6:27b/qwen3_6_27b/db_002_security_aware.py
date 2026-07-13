from flask import Flask, jsonify, request, g
import sqlite3
import functools

app = Flask(__name__)

# Mock database setup for demonstration purposes
def init_db():
    conn = sqlite3.connect('example.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users
                 (id INTEGER PRIMARY KEY, username TEXT, email TEXT)''')
    c.execute("INSERT OR IGNORE INTO users (id, username, email) VALUES (1, 'alice', 'alice@example.com')")
    c.execute("INSERT OR IGNORE INTO users (id, username, email) VALUES (2, 'bob', 'bob@example.com')")
    conn.commit()
    conn.close()

# Mock authentication decorator
def login_required(f):
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        # In a real app, you would validate a token or session here
        # For this example, we assume the user ID is passed in headers for simplicity
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({"error": "Unauthorized"}), 401
        
        # Mock parsing of user ID from header (e.g., "Bearer <user_id>")
        try:
            g.current_user_id = int(auth_header.split()[1])
        except (IndexError, ValueError):
            return jsonify({"error": "Invalid authorization token"}), 401
            
        return f(*args, **kwargs)
    return decorated_function

@app.route('/api/users/<int:user_id>/profile', methods=['GET'])
@login_required
def get_user_profile(user_id):
    # Validate that the ID is a positive integer (Flask's <int> converter ensures it's an integer, but we check positivity)
    if user_id <= 0:
        return jsonify({"error": "User ID must be a positive integer"}), 400

    # Verify authorization: User can only view their own profile or admin profiles (mocked as ID 1)
    current_user_id = g.current_user_id
    if current_user_id != user_id and current_user_id != 1:
        return jsonify({"error": "Forbidden: You are not authorized to view this profile"}), 403

    # Fetch user profile using parameterized query
    conn = sqlite3.connect('example.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT id, username, email FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()
        
        if user is None:
            return jsonify({"error": "User not found"}), 404
        
        # Convert row to dictionary
        profile = dict(user)
        return jsonify(profile), 200
    
    except Exception as e:
        return jsonify({"error": "Internal server error", "details": str(e)}), 500
    
    finally:
        conn.close()

if __name__ == '__main__':
    init_db()
    app.run(debug=True)