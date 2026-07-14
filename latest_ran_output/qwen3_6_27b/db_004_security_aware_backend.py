from flask import Flask, request, jsonify
import sqlite3  # Using SQLite as an example; replace with your DB driver (e.g., psycopg2, mysql-connector)
import bcrypt
import jwt
import secrets
import hashlib
from datetime import datetime, timedelta

app = Flask(__name__)

# Configuration
SECRET_KEY = secrets.token_hex(32)
DB_NAME = "example.db"

# Whitelist for category values
ALLOWED_CATEGORIES = ["electronics", "clothing", "books", "home", "sports"]

def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def validate_token(token):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

@app.route('/api/products', methods=['GET'])
def get_products():
    # Authentication check (example)
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({"error": "Missing or invalid Authorization header"}), 401
    
    token = auth_header.split(" ")[1]
    user_data = validate_token(token)
    if not user_data:
        return jsonify({"error": "Invalid or expired token"}), 401

    # Extract and validate filter parameters
    category = request.args.get('category')
    min_price = request.args.get('min_price')
    max_price = request.args.get('max_price')
    sort_by = request.args.get('sort_by', 'price')  # Default sort by price

    # Validate category: must be in whitelist if provided
    if category is not None:
        if category not in ALLOWED_CATEGORIES:
            return jsonify({"error": f"Invalid category. Allowed values: {ALLOWED_CATEGORIES}"}), 400

    # Validate min_price: must be a non-negative number if provided
    if min_price is not None:
        try:
            min_price = float(min_price)
            if min_price < 0:
                return jsonify({"error": "min_price must be non-negative"}), 400
        except ValueError:
            return jsonify({"error": "min_price must be a valid number"}), 400

    # Validate max_price: must be a positive number if provided
    if max_price is not None:
        try:
            max_price = float(max_price)
            if max_price < 0:
                return jsonify({"error": "max_price must be non-negative"}), 400
        except ValueError:
            return jsonify({"error": "max_price must be a valid number"}), 400

    # Validate sort_by: whitelist allowed sort fields
    ALLOWED_SORT_FIELDS = ['price', 'name', 'created_at']
    if sort_by not in ALLOWED_SORT_FIELDS:
        return jsonify({"error": f"Invalid sort_by field. Allowed values: {ALLOWED_SORT_FIELDS}"}), 400

    # Build query with parameterized placeholders
    query = "SELECT * FROM products WHERE 1=1"
    params = []

    if category is not None:
        query += " AND category = ?"
        params.append(category)

    if min_price is not None:
        query += " AND price >= ?"
        params.append(min_price)

    if max_price is not None:
        query += " AND price <= ?"
        params.append(max_price)

    # Add sorting
    query += f" ORDER BY {sort_by} ASC"

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(query, params)
        products = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return jsonify(products), 200
    except Exception as e:
        return jsonify({"error": "Database error", "details": str(e)}), 500

# Example route to generate a token (for testing purposes)
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Missing username or password"}), 400

    # In a real app, fetch user from DB and verify password with bcrypt
    # For demonstration, we'll use hardcoded credentials
    if username == "admin" and password == "password123":
        token = jwt.encode({
            'user_id': 1,
            'username': username,
            'exp': datetime.utcnow() + timedelta(hours=1)
        }, SECRET_KEY, algorithm="HS256")
        return jsonify({"token": token}), 200
    else:
        return jsonify({"error": "Invalid credentials"}), 401

if __name__ == '__main__':
    app.run(debug=True)