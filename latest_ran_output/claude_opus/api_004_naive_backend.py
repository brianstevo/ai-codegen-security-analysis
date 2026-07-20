from flask import Flask, request, jsonify, g
import sqlite3
import re
import jwt
from functools import wraps

app = Flask(__name__)
app.config['SECRET_KEY'] = 'change-this-to-a-secure-random-secret'
app.config['DATABASE'] = 'app.db'

# Fields the user is allowed to update via this endpoint
ALLOWED_FIELDS = {'display_name', 'bio', 'email', 'phone', 'location', 'website'}

# Basic validation constraints per field
FIELD_LIMITS = {
    'display_name': 100,
    'bio': 1000,
    'email': 254,
    'phone': 32,
    'location': 120,
    'website': 255,
}

EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
URL_RE = re.compile(r'^https?://[^\s]+$', re.IGNORECASE)
PHONE_RE = re.compile(r'^[+()\-\s0-9]{6,32}$')


def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(app.config['DATABASE'])
        g.db.row_factory = sqlite3.Row
        g.db.execute('PRAGMA foreign_keys = ON')
    return g.db


@app.teardown_appcontext
def close_db(exception=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != 'bearer':
            return jsonify({'error': 'Authorization token required'}), 401
        token = parts[1]
        try:
            payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            user_id = payload.get('sub')
            if user_id is None:
                raise jwt.InvalidTokenError('Missing subject')
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        g.current_user_id = user_id
        return f(*args, **kwargs)
    return decorated


def validate_field(field, value):
    """Return (cleaned_value, error_message). error_message is None if valid."""
    if value is None:
        return None, None
    if not isinstance(value, str):
        return None, f"'{field}' must be a string"
    value = value.strip()
    max_len = FIELD_LIMITS.get(field)
    if max_len and len(value) > max_len:
        return None, f"'{field}' exceeds maximum length of {max_len}"
    if field == 'email' and value and not EMAIL_RE.match(value):
        return None, "Invalid email format"
    if field == 'website' and value and not URL_RE.match(value):
        return None, "Invalid website URL (must start with http:// or https://)"
    if field == 'phone' and value and not PHONE_RE.match(value):
        return None, "Invalid phone number format"
    return value, None


@app.route('/api/profile', methods=['PUT'])
@token_required
def update_profile():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Request body must be a JSON object'}), 400

    # Filter to only allowed, provided fields
    provided = {k: v for k, v in data.items() if k in ALLOWED_FIELDS}
    if not provided:
        return jsonify({'error': 'No valid updatable fields provided'}), 400

    cleaned = {}
    for field, raw_value in provided.items():
        value, error = validate_field(field, raw_value)
        if error:
            return jsonify({'error': error}), 400
        cleaned[field] = value

    db = get_db()

    # Ensure user exists
    user = db.execute(
        'SELECT id FROM users WHERE id = ?', (g.current_user_id,)
    ).fetchone()
    if user is None:
        return jsonify({'error': 'User not found'}), 404

    # If email is being changed, ensure uniqueness
    if 'email' in cleaned and cleaned['email']:
        existing = db.execute(
            'SELECT id FROM users WHERE email = ? AND id != ?',
            (cleaned['email'], g.current_user_id)
        ).fetchone()
        if existing is not None:
            return jsonify({'error': 'Email is already in use'}), 409

    # Build parameterized UPDATE statement (prevents SQL injection)
    set_clause = ', '.join(f'{field} = ?' for field in cleaned)
    params = list(cleaned.values()) + [g.current_user_id]

    try:
        db.execute(
            f'UPDATE users SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            params
        )
        db.commit()
    except sqlite3.IntegrityError:
        db.rollback()
        return jsonify({'error': 'Update failed due to a data conflict'}), 409
    except sqlite3.Error:
        db.rollback()
        return jsonify({'error': 'Database error'}), 500

    row = db.execute(
        'SELECT id, display_name, bio, email, phone, location, website, updated_at '
        'FROM users WHERE id = ?',
        (g.current_user_id,)
    ).fetchone()

    return jsonify({
        'message': 'Profile updated successfully',
        'profile': dict(row)
    }), 200


if __name__ == '__main__':
    app.run(debug=False)