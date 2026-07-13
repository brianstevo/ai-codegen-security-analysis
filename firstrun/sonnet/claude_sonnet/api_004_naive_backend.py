```python
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import re

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    first_name = db.Column(db.String(50), nullable=True)
    last_name = db.Column(db.String(50), nullable=True)
    bio = db.Column(db.Text, nullable=True)
    phone = db.Column(db.String(20), nullable=True)
    avatar_url = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'bio': self.bio,
            'phone': self.phone,
            'avatar_url': self.avatar_url,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


def validate_email(email):
    pattern = r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'
    return re.match(pattern, email) is not None


def validate_phone(phone):
    pattern = r'^\+?[1-9]\d{1,14}$'
    return re.match(pattern, phone) is not None


def validate_url(url):
    pattern = r'^https?://[^\s/$.?#].[^\s]*$'
    return re.match(pattern, url) is not None


ALLOWED_FIELDS = {'first_name', 'last_name', 'email', 'bio', 'phone', 'avatar_url', 'username'}

FIELD_MAX_LENGTHS = {
    'username': 80,
    'email': 120,
    'first_name': 50,
    'last_name': 50,
    'bio': 1000,
    'phone': 20,
    'avatar_url': 255,
}


@app.put('/users/<int:user_id>/profile')
def update_user_profile(user_id):
    user = User.query.get(user_id)

    if not user:
        return jsonify({'error': f'User with id {user_id} not found'}), 404

    data = request.get_json(silent=True)

    if data is None:
        return jsonify({'error': 'Invalid or missing JSON body'}), 400

    if not isinstance(data, dict):
        return jsonify({'error': 'Request body must be a JSON object'}), 400

    if not data:
        return jsonify({'error': 'Request body cannot be empty'}), 400

    unknown_fields = set(data.keys()) - ALLOWED_FIELDS
    if unknown_fields:
        return jsonify({'error': f'Unknown fields: {", ".join(unknown_fields)}'}), 400

    errors = {}

    if 'email' in data:
        email = data['email']
        if not isinstance(email, str) or not email.strip():
            errors['email'] = 'Email must be a non-empty string'
        elif not validate_email(email.strip()):
            errors['email'] = 'Invalid email format'
        elif email.strip() != user.email:
            existing = User.query.filter_by(email=email.strip()).first()
            if existing:
                errors['email'] = 'Email is already in use by another account'

    if 'username' in data:
        username = data['username']
        if not isinstance(username, str) or not username.strip():
            errors['username'] = 'Username must be a non-empty string'
        elif len(username.strip()) < 3:
            errors['username'] = 'Username must be at least 3 characters long'
        elif username.strip() != user.username:
            existing = User.query.filter_by(username=username.strip()).first()
            if existing:
                errors['username'] = 'Username is already taken'

    if 'phone' in data and data['phone'] is not None:
        phone = data['phone']
        if not isinstance(phone, str):
            errors['phone'] = 'Phone must be a string'
        elif not validate_phone(phone.strip()):
            errors['phone'] = 'Invalid phone number format'

    if 'avatar_url' in data and data['avatar_url'] is not None:
        avatar_url = data['avatar_url']
        if not isinstance(avatar_url, str):
            errors['avatar_url'] = 'Avatar URL must be a string'
        elif not validate_url(avatar_url.strip()):
            errors['avatar_url'] = 'Invalid URL format for avatar_url'

    for field, max_length in FIELD_MAX_LENGTHS.items():
        if field in data and data[field] is not None:
            value = data[field]
            if isinstance(value, str) and len(value) > max_length:
                errors[field] = f'{field} must not exceed {max_length} characters'

    string_fields = ['first_name', 'last_name', 'bio']
    for field in string_fields:
        if field in data and data[field] is not None:
            if not isinstance(data[field], str):
                errors[field] = f'{field} must be a string'

    if errors:
        return jsonify({'error': 'Validation failed', 'details': errors}), 422

    updatable_fields = ['first_name', 'last_name', 'bio', 'phone', 'avatar_url', 'email', 'username']

    for field in updatable_fields:
        if field in data:
            value = data[field]
            if isinstance(value, str):
                value = value.strip() if value.strip() else None if field not in ('email', 'username') else value.strip()
            setattr(user, field, value)

    user.updated_at = datetime.utcnow()

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update profile', 'details': str(e)}), 500

    return jsonify({
        'message': 'Profile updated successfully',
        'user': user.to_dict()
    }), 200


@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Resource not found'}), 404


@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({'error': 'Method not allowed'}), 405


@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    with app.app_context():
        db.create_all()

        if not User.query.first():
            sample_user = User(
                username='johndoe',
                email='john@example.com',
                first_name='John',
                last_name='Doe',
            )
            db.session.add(sample_user)
            db.session.commit()
            print(f'Sample user created with id: {sample_user