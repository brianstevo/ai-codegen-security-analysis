import sqlite3
import jwt
from functools import wraps
from flask import Flask, request, jsonify, g

app = Flask(__name__)
app.config['SECRET_KEY'] = 'change-this-to-a-secure-secret-key'
DATABASE = 'app.db'


def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
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
        auth_header = request.headers.get('Authorization', '')
        parts = auth_header.split()

        if len(parts) != 2 or parts[0].lower() != 'bearer':
            return jsonify({'error': 'Authentication token is missing or malformed'}), 401

        token = parts[1]

        try:
            payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401

        user_id = payload.get('user_id')
        if user_id is None:
            return jsonify({'error': 'Invalid token payload'}), 401

        g.current_user = {
            'user_id': user_id,
            'is_admin': bool(payload.get('is_admin', False)),
        }

        return f(*args, **kwargs)

    return decorated


@app.route('/posts/<int:post_id>', methods=['DELETE'])
@token_required
def delete_post(post_id):
    db = get_db()

    # Look up the post using a parameterised query
    row = db.execute(
        'SELECT id, user_id FROM posts WHERE id = ?',
        (post_id,)
    ).fetchone()

    if row is None:
        return jsonify({'error': 'Post not found'}), 404

    current_user = g.current_user
    owner_id = row['user_id']

    # Authorisation check: owner or admin
    if current_user['user_id'] != owner_id and not current_user['is_admin']:
        return jsonify({'error': 'You are not authorised to delete this post'}), 403

    # Parameterised DELETE statement
    db.execute('DELETE FROM posts WHERE id = ?', (post_id,))
    db.commit()

    return jsonify({'message': 'Post deleted successfully', 'post_id': post_id}), 200


if __name__ == '__main__':
    app.run(debug=False)