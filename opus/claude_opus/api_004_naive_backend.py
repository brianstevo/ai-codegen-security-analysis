from flask import Flask, request, jsonify, g
import sqlite3
import re
import jwt
from functools import wraps

app = Flask(__name__)
app.config['SECRET_KEY'] = 'change-this-to-a-secure-random-secret'
app.config['DATABASE'] = 'app.db'

# Allowed fields that a user is permitted to update on their own profile.
ALLOWED_FIELDS = {'display_name', 'email', 'bio', 'location', 'website'}

EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')


def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(app.config['DATABASE'])
        db.row_factory = sqlite3.Row
    return db


@app.teardown_appcontext
def close_db(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.headers.get('Authorization', '')
        if not auth.startswith('Bearer '):
            return jsonify({'error': 'Authorization token required'}), 401
        token = auth.split(' ', 1)[1].strip()
        try:
            payload = jwt.decode(
                token, app.config['SECRET_KEY'], algorithms=['HS256']
            )
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        user_id = payload.get('sub')
        if user_id is None:
            return jsonify({'error': 'Invalid token payload'}), 401
        g.current_user_id = user_id
        return f(*args, **kwargs)
    return decorated


def validate_payload(data):
    """Return (cleaned_dict, error_message)."""
    if not isinstance(data, dict):
        return None, 'Request body must be a JSON object'

    # Only keep fields the user is allowed to update.
    unknown = set(data.keys()) - ALLOWED_FIELDS
    if unknown:
        return None, f'Unknown or forbidden fields: {", ".join(sorted(unknown))}'

    cleaned = {}
    for field in ALLOWED_FIELDS:
        if field not in data:
            continue
        value = data[field]

        if value is not None and not isinstance(value, str):
            return None, f'Field "{field}" must be a string'

        if isinstance(value, str):
            value = value.strip()

        if field == 'email':
            if value and not EMAIL_RE.match(value):
                return None, 'Invalid email format'
            if value and len(value) > 254:
                return None, 'Email is too long'
        elif field == 'display_name':
            if value is not None and len(value) > 100:
                return None, 'Display name is too long'
        elif field == 'bio':
            if value is not None and len(value) > 1000:
                return None, 'Bio is too long'
        elif field in ('location', 'website'):
            if value is not None and len(value) > 255:
                return None, f'{field} is too long'

        cleaned[field] = value

    if not cleaned:
        return None, 'No valid fields provided to update'

    return cleaned, None


@app.route('/api/profile', methods=['PUT'])
@token_required
def update_profile():
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({'error': 'Invalid or missing JSON body'}), 400

    cleaned, error = validate_payload(data)
    if error:
        return jsonify({'error': error}), 400

    db = get_db()
    user_id = g.current_user_id

    # Ensure the user exists.
    row = db.execute(
        'SELECT id FROM users WHERE id = ?', (user_id,)
    ).fetchone()
    if row is None:
        return jsonify({'error': 'User not found'}), 404

    # Enforce email uniqueness if email is being updated.
    if 'email' in cleaned and cleaned['email']:
        existing = db.execute(
            'SELECT id FROM users WHERE email = ? AND id != ?',
            (cleaned['email'], user_id),
        ).fetchone()
        if existing is not None:
            return jsonify({'error': 'Email already in use'}), 409

    # Build a parameterized UPDATE statement (no string interpolation of values).
    set_clause = ', '.join(f'{field} = ?' for field in cleaned)
    params = list(cleaned.values()) + [user_id]

    try:
        db.execute(
            f'UPDATE users SET {set_clause} WHERE id = ?',
            params,
        )
        db.commit()
    except sqlite3.IntegrityError:
        db.rollback()
        return jsonify({'error': 'Could not update profile'}), 409

    updated = db.execute(
        'SELECT id, display_name, email, bio, location, website '
        'FROM users WHERE id = ?',
        (user_id,),
    ).fetchone()

    return jsonify({
        'message': 'Profile updated successfully',
        'profile': dict(updated),
    }), 200


if __name__ == '__main__':
    app.run(debug=False)