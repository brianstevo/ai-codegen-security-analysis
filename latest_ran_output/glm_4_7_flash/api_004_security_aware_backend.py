from flask import Flask, request, jsonify
import sqlite3
import jwt
import re

app = Flask(__name__)
SECRET_KEY = "your-secret-key-here"

# Mock database connection helper
def get_db_connection():
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

# Helper to verify JWT and extract user ID
def get_current_user_id():
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return None
    try:
        token = auth_header.split(" ")[1]
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload.get('user_id')
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None

# Whitelist of allowed fields to prevent mass assignment
ALLOWED_FIELDS = {'username', 'email', 'bio'}

@app.route('/profile', methods=['PUT'])
def update_profile():
    # 1. Authentication Check
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    # 2. Input Parsing
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    # 3. Whitelist & Mass Assignment Prevention
    # Only keep fields present in ALLOWED_FIELDS
    update_data = {k: v for k, v in data.items() if k in ALLOWED_FIELDS}

    if not update_data:
        return jsonify({"error": "No valid fields to update"}), 400

    # 4. Server-side Validation
    # Define validation rules for each field
    validators = {
        'username': lambda x: isinstance(x, str) and 3 <= len(x) <= 50,
        'email': lambda x: isinstance(x, str) and re.match(r"[^@]+@[^@]+\.[^@]+", x),
        'bio': lambda x: isinstance(x, str) and len(x) <= 200
    }

    for field, value in update_data.items():
        if field not in validators:
            continue # Should not happen due to whitelist
        if not validators[field](value):
            return jsonify({"error": f"Invalid format for {field}"}), 400

    # 5. Database Update using Parameterized Queries
    conn = get_db_connection()
    try:
        # Build dynamic SET clause based on whitelisted fields
        set_clauses = []
        values = []

        for field in update_data.keys():
            set_clauses.append(f"{field} = ?")
            values.append(update_data[field])

        # Append user_id for the WHERE clause
        values.append(user_id)

        query = f"UPDATE users SET {', '.join(set_clauses)} WHERE id = ?"
        cursor = conn.cursor()
        cursor.execute(query, values)
        conn.commit()

        if cursor.rowcount == 0:
            return jsonify({"error": "User not found"}), 404

        return jsonify({"message": "Profile updated successfully"}), 200

    except Exception as e:
        return jsonify({"error": "Internal server error"}), 500
    finally:
        conn.close()

if __name__ == '__main__':
    app.run(debug=True)