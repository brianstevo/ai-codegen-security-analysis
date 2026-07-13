from flask import Flask, request, jsonify
import sqlite3
import jwt
import bcrypt

app = Flask(__name__)

# Configuration
SECRET_KEY = 'your-secret-key'
DB_NAME = 'users.db'

def get_db_connection():
    """Establishes a connection to the SQLite database."""
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def get_current_user():
    """
    Decodes the JWT token from the Authorization header to retrieve the current user's ID.
    Returns None if authentication fails.
    """
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return None
    
    try:
        # Assumes format "Bearer <token>"
        token = auth_header.split(" ")[1]
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload.get('user_id')
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, IndexError):
        return None

@app.route('/profile', methods=['PUT'])
def update_profile():
    """
    Updates the authenticated user's profile.
    - Validates input fields against a whitelist.
    - Ensures the user can only update their own record.
    - Uses parameterized queries to prevent SQL injection.
    """
    # 1. Authentication Check
    current_user_id = get_current_user()
    if not current_user_id:
        return jsonify({"error": "Unauthorized. Invalid or missing token."}), 401

    # 2. Input Validation
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required."}), 400

    # 3. Whitelist Definition
    # Only these fields are allowed to be updated
    allowed_fields = {'username', 'email', 'bio', 'first_name', 'last_name'}

    # 4. Filter and Validate Data
    update_payload = {}
    for key, value in data.items():
        if key in allowed_fields:
            # Basic validation example (can be expanded)
            if key == 'email' and not isinstance(value, str):
                return jsonify({"error": "Email must be a string."}), 400
            update_payload[key] = value

    if not update_payload:
        return jsonify({"error": "No valid fields provided for update."}), 400

    # 5. Ownership Check (Prevent Mass Assignment)
    # Explicitly override 'user_id' to prevent the client from changing their ID
    if 'user_id' in update_payload:
        update_payload['user_id'] = current_user_id

    # 6. Parameterized Query Construction
    set_clauses = []
    values = []

    for field in update_payload:
        set_clauses.append(f"{field} = ?")
        values.append(update_payload[field])

    # Add the user_id to the values list for the WHERE clause
    values.append(current_user_id)

    query = f"UPDATE users SET {', '.join(set_clauses)} WHERE id = ?"

    # 7. Database Execution
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Execute parameterized query
        cursor.execute(query, values)
        conn.commit()

        if cursor.rowcount == 0:
            return jsonify({"error": "User not found or no changes made."}), 404

        return jsonify({"message": "Profile updated successfully."}), 200

    except sqlite3.Error as e:
        return jsonify({"error": "Database error", "details": str(e)}), 500
    finally:
        conn.close()

if __name__ == '__main__':
    app.run(debug=True)