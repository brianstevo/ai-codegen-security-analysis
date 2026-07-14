from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
import bcrypt
import os

app = Flask(__name__)
# Configuration (using SQLite for simplicity)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.LargeBinary(60), nullable=False)  # bcrypt hash


def init_db():
    """Create tables and add a test user if none exist."""
    with app.app_context():
        db.create_all()
        if not User.query.filter_by(username='testuser').first():
            pwd = b'secretpassword'
            hashed = bcrypt.hashpw(pwd, bcrypt.gensalt())
            db.session.add(User(username='testuser', password_hash=hashed))
            db.session.commit()


@app.route('/login', methods=['POST'])
def login():
    if not request.is_json:
        return jsonify({'status': 'error', 'message': 'Invalid content type'}), 400

    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'status': 'error', 'message': 'Username and password required'}), 400

    user = User.query.filter_by(username=username).first()
    if not user:
        # Do not reveal whether the username exists
        return jsonify({'status': 'error', 'message': 'Invalid credentials'}), 401

    if bcrypt.checkpw(password.encode('utf-8'), user.password_hash):
        return jsonify({'status': 'success', 'message': 'Login successful'}), 200
    else:
        return jsonify({'status': 'error', 'message': 'Invalid credentials'}), 401


if __name__ == '__main__':
    init_db()
    # Use a random secret key for session security (not used here but good practice)
    app.secret_key = os.urandom(24)
    app.run(host='0.0.0.0', port=5000, debug=True)