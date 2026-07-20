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
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None


def validate_phone(phone):
    pattern = r'^\+?[1-9]\d{1,14}$'
    return re.match(pattern, phone) is not None


def validate_url(url):
    pattern = r'^https?://[^\s/$.?#].[^\s]*$'
    return re.match(pattern, url) is not None


@app.put('/users/<int:user_id>/profile')
def update_user_profile(user_id):
    user = User.query.get(user_id)

    if not user:
        return jsonify({
            'success': False,
            'error': 'User not found'
        }), 404

    data = request.get_json()

    if not data:
        return jsonify({
            'success': False,
            'error': 'Request body must be valid JSON'
        }), 400

    if not isinstance(data, dict):
        return jsonify({
            'success': False,
            'error': 'Request body must be a JSON object'
        }), 400

    allowed_fields = {'email', 'first_name', 'last_name', 'bio', 'phone', 'avatar_url'}
    unknown_fields = set(data.keys()) - allowed_fields

    if unknown_fields:
        return jsonify({
            'success': False,
            'error': f'Unknown fields: {", ".join(unknown_fields)}'
        }), 400

    errors = {}

    if 'email' in data:
        email = data['email']
        if not isinstance(email, str) or not email.strip():
            errors['email'] = 'Email must be a non-empty string'
        elif not validate_email(email.strip()):
            errors['email'] = 'Invalid email format'
        else:
            existing_user = User.query.filter(
                User.email == email.strip().lower(),
                User.id != user_id
            ).first()
            if existing_user:
                errors['email'] = 'Email is already in use by another account'

    if 'first_name' in data:
        first_name = data['first_name']
        if first_name is not None:
            if not isinstance(first_name, str):
                errors['first_name'] = 'First name must be a string'
            elif len(first_name.strip()) > 50:
                errors['first_name'] = 'First name must not exceed 50 characters'

    if 'last_name' in data:
        last_name = data['last_name']
        if last_name is not None:
            if not isinstance(last_name, str):
                errors['last_name'] = 'Last name must be a string'
            elif len(last_name.strip()) > 50:
                errors['last_name'] = 'Last name must not exceed 50 characters'

    if 'bio' in data:
        bio = data['bio']
        if bio is not None:
            if not isinstance(bio, str):
                errors['bio'] = 'Bio must be a string'
            elif len(bio) > 500:
                errors['bio'] = 'Bio must not exceed 500 characters'

    if 'phone' in data:
        phone = data['phone']
        if phone is not None:
            if not isinstance(phone, str):
                errors['phone'] = 'Phone must be a string'
            elif not validate_phone(phone.strip()):
                errors['phone'] = 'Invalid phone number format'

    if 'avatar_url' in data:
        avatar_url = data['avatar_url']
        if avatar_url is not None:
            if not isinstance(avatar_url, str):
                errors['avatar_url'] = 'Avatar URL must be a string'
            elif not validate_url(avatar_url.strip()):
                errors['avatar_url'] = 'Invalid URL format'
            elif len(avatar_url.strip()) > 255:
                errors['avatar_url'] = 'Avatar URL must not exceed 255 characters'

    if errors:
        return jsonify({
            'success': False,
            'error': 'Validation failed',
            'details': errors
        }), 422

    try:
        if 'email' in data:
            user.email = data['email'].strip().lower()

        if 'first_name' in data:
            user.first_name = data['first_name'].strip() if data['first_name'] else None

        if 'last_name' in data:
            user.last_name = data['last_name'].strip() if data['last_name'] else None

        if 'bio' in data:
            user.bio = data['bio'].strip() if data['bio'] else None

        if 'phone' in data:
            user.phone = data['phone'].strip() if data['phone'] else None

        if 'avatar_url' in data:
            user.avatar_url = data['avatar_url'].strip() if data['avatar_url'] else None

        user.updated_at = datetime.utcnow()

        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Profile updated successfully',
            'data': user.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': 'An error occurred while updating the profile',
            'details': str(e)
        }), 500


with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(debug=True)