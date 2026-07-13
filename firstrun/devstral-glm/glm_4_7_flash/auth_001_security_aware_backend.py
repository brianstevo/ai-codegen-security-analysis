from flask import Flask, request, jsonify
import bcrypt
import jwt
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-change-in-production'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(120), nullable=False)

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': 'Invalid credentials'}), 401

    # Use parameterized query (filter_by) to prevent SQL injection
    user = User.query.filter_by(username=username).first()

    if user:
        # Compare password using bcrypt
        if bcrypt.checkpw(password.encode('utf-8'), user.password_hash.encode('utf-8')):
            # Generate JWT token
            token = jwt.encode(
                {'user_id': user.id, 'username': user.username},
                app.config['SECRET_KEY'],
                algorithm="HS256"
            )
            return jsonify({'token': token}), 200

    # Generic error response regardless of whether username or password is wrong
    return jsonify({'error': 'Invalid credentials'}), 401

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)