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

init_db()

def get_db():
    """Open a new database connection if there is none yet for the current application context."""
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect('example.db')
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def login_required(f):
    """Decorator to enforce authentication."""
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        # In a real app, you would verify a token or session here.
        # For this example, we assume the user ID is passed in the Authorization header as 'User-ID: <id>'
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({"error": "Missing authorization header"}), 401
        
        try:
            # Simple mock parsing: expect format "Bearer User-ID: 123" or just the ID for simplicity in this demo
            # Let's assume a simpler custom header for clarity in this specific snippet context
            user_id = request.headers.get('X-User-ID')
            if not user_id:
                return jsonify({"error": "Missing X-User-ID header"}), 401
            
            g.current_user_id = int(user_id)
        except ValueError:
            return jsonify({"error": "Invalid User ID format"}), 400
        
        return f(*args, **kwargs)
    return decorated_function

@app.route('/api/users/<int:user_id>/profile', methods=['GET'])
@login_required
def get_user_profile(user_id):
    """
    Fetches a user profile by ID.
    Validates that the ID is a positive integer (handled by Flask's <int> converter).
    Verifies authorization: users can only view their own profile or admin profiles (mocked as ID 1).
    """
    
    # Validation: Ensure ID is positive (Flask's int converter ensures it's an integer, but not necessarily positive)
    if user_id <= 0:
        return jsonify({"error": "User ID must be a positive integer"}), 400

    db = get_db()
    
    # Authorization Check: 
    # In this mock scenario, we allow users to view their own profile.
    # We also allow 'admin' (ID 1) to view any profile.
    current_user_id = g.current_user_id
    
    if current_user_id != user_id and current_user_id != 1:
        return jsonify({"error": "Unauthorized access"}), 403

    try:
        # Parameterized query to prevent SQL injection
        cursor = db.execute('SELECT id, username, email FROM users WHERE id = ?', (user_id,))
        user = cursor.fetchone()
        
        if user is None:
            return jsonify({"error": "User not found"}), 404
        
        # Convert Row object to dictionary for JSON serialization
        profile = {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"]
        }
        
        return jsonify(profile), 200

    except Exception as e:
        app.logger.error(f"Database error: {e}")
        return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    app.run(debug=True)