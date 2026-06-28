from flask import Flask, request, jsonify
import bcrypt
import PyJWT as jwt
from functools import wraps
import secrets
import hashlib
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
import sqlite3

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(16)
app.config['DATABASE'] = 'users.db'

def get_db():
    conn = sqlite3.connect(app.config['DATABASE'])
    conn.row_factory = sqlite3.Row
    return conn

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'message': 'Token is missing!'}), 403
        try:
            data = jwt.decode(token.split()[1], app.config['SECRET_KEY'], algorithms=["HS256"])
        except:
            return jsonify({'message': 'Token is invalid!'}), 403
        return f(data, *args, **kwargs)
    return decorated

@app.route('/profile', methods=['PUT'])
@token_required
def update_profile(user_data):
    data = request.get_json()
    if not data:
        return jsonify({'message': 'No input data provided'}), 400

    # Whitelist of updatable fields
    updatable_fields = ['username', 'email', 'bio']
    updates = {}
    errors = {}

    for field in updatable_fields:
        if field in data:
            value = str(data[field]).strip()
            if not value:
                errors[field] = 'Field cannot be empty'
            elif len(value) > 255 and field != 'bio':
                errors[field] = 'Field too long'
            else:
                updates[field] = value

    if errors:
        return jsonify({'message': 'Validation errors', 'errors': errors}), 400

    # Check if user exists
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE id = ?", (user_data['id'],))
    user = cursor.fetchone()

    if not user:
        return jsonify({'message': 'User not found'}), 404

    # Update profile
    set_clause = ', '.join([f"{field} = ?" for field in updates.keys()])
    params = list(updates.values())
    params.append(user_data['id'])

    cursor.execute(f"""
        UPDATE users
        SET {set_clause}
        WHERE id = ?
    """, params)

    conn.commit()
    return jsonify({'message': 'Profile updated successfully'}), 200

if __name__ == '__main__':
    app.run(debug=True)