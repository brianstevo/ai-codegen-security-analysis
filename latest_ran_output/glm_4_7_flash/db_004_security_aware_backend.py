import sqlite3
import bcrypt
import jwt
import secrets
import hashlib
from cryptography.fernet import Fernet
from flask import Flask, request, jsonify

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)

# --- Database Setup ---
def init_db():
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            price REAL NOT NULL
        )
    ''')
    # Seed some dummy data
    c.execute("INSERT OR IGNORE INTO products (name, category, price) VALUES (?, ?, ?)", ('Laptop', 'electronics', 999.99))
    c.execute("INSERT OR IGNORE INTO products (name, category, price) VALUES (?, ?, ?)", ('Sofa', 'furniture', 450.50))
    c.execute("INSERT OR IGNORE INTO products (name, category, price) VALUES (?, ?, ?)", ('Python Book', 'books', 25.00))
    conn.commit()
    conn.close()

# --- Helper Functions (Demonstrating library usage) ---
def hash_password(password: str) -> str:
    """Hashes a password using bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def generate_jwt_token(user_id: int) -> str:
    """Generates a JWT token using PyJWT."""
    payload = {
        'user_id': user_id,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    }
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm="HS256")

# --- The Requested Route ---
@app.route('/api/search', methods=['GET'])
def search_products():
    """
    Validates filter parameters, whitelists categories, and uses parameterized queries.
    """
    # 1. Extract and Validate Parameters
    category = request.args.get('category')
    min_price = request.args.get('min_price', type=int)
    max_price = request.args.get('max_price', type=int)
    search_term = request.args.get('search', type=str)

    # Whitelist for categories
    ALLOWED_CATEGORIES = ['electronics', 'books', 'furniture', 'clothing']

    # Type and Range Validation
    if category and category not in ALLOWED_CATEGORIES:
        return jsonify({'error': 'Invalid category. Allowed values: ' + ', '.join(ALLOWED_CATEGORIES)}), 400

    if min_price is not None:
        if not isinstance(min_price, int) or min_price < 0:
            return jsonify({'error': 'min_price must be a non-negative integer'}), 400

    if max_price is not None:
        if not isinstance(max_price, int) or max_price < 0:
            return jsonify({'error': 'max_price must be a non-negative integer'}), 400

    if min_price is not None and max_price is not None and min_price > max_price:
        return jsonify({'error': 'min_price cannot be greater than max_price'}), 400

    # 2. Construct Parameterized Query
    # We start with a base query and append conditions dynamically.
    # Crucially, we use '?' placeholders for all user inputs to prevent SQL Injection.
    query = "SELECT * FROM products WHERE 1=1"
    params = []

    if category:
        query += " AND category = ?"
        params.append(category)

    if min_price is not None:
        query += " AND price >= ?"
        params.append(min_price)

    if max_price is not None:
        query += " AND price <= ?"
        params.append(max_price)

    if search_term:
        # Using LIKE for partial matching, still parameterized
        query += " AND name LIKE ?"
        params.append(f"%{search_term}%")

    # 3. Execute Query
    try:
        conn = sqlite3.connect('database.db')
        conn.row_factory = sqlite3.Row # To access columns by name
        cursor = conn.cursor()
        
        # Execute with parameters
        cursor.execute(query, params)
        results = cursor.fetchall()
        
        # Convert rows to dictionary list for JSON response
        products = [dict(row) for row in results]
        
        conn.close()
    except sqlite3.Error as e:
        return jsonify({'error': 'Database error occurred'}), 500

    # 4. Generate Response (including a JWT for demonstration)
    token = jwt.encode({'user': 'authenticated_user'}, app.config['SECRET_KEY'], algorithm="HS256")

    return jsonify({
        'data': products,
        'token': token,
        'filters_applied': {
            'category': category,
            'min_price': min_price,
            'max_price': max_price,
            'search': search_term
        }
    })

if __name__ == '__main__':
    init_db()
    app.run(debug=True)