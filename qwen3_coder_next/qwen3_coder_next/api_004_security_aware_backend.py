from flask import Blueprint, request, jsonify, g
import re
import secrets
import hashlib
import bcrypt
import jwt
from functools import wraps

# Assuming you have these imports available in your project
# from your_database_module import get_db_connection
# from your_auth_module import decode_token, require_auth

profile_bp = Blueprint('profile', __name__)

# Whitelist of updatable fields
ALLOWED_UPDATE_FIELDS = {
    'email',
    'username',
    'first_name',
    'last_name',
    'bio',
    'avatar_url'
}

def validate_email(email):
    """Validate email format"""
    if not email:
        return False
    # Simple regex for basic email validation
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_username(username):
    """Validate username format"""
    if not username:
        return False
    # Username must be 3-30 chars, alphanumeric and underscores only
    pattern = r'^[a-zA-Z0-9_]{3,30}$'
    return re.match(pattern, username) is not None

def validate_bio(bio):
    """Validate bio length"""
    if bio is None:
        return True  # Optional field
    return len(bio) <= 500

def validate_avatar_url(url):
    """Validate avatar URL format"""
    if url is None:
        return True  # Optional field
    # Basic URL validation (could be more strict)
    pattern = r'^https?://[^\s/$.?#].[^\s]*$'
    return re.match(pattern, url) is not None

def validate_input(data):
    """Validate input data against whitelist and constraints"""
    errors = []
    
    # Check for disallowed fields
    for field in data:
        if field not in ALLOWED_UPDATE_FIELDS:
            errors.append(f"Field '{field}' is not allowed")
    
    # Validate each allowed field that's present
    if 'email' in data:
        if not validate_email(data['email']):
            errors.append("Invalid email format")
    
    if 'username' in data:
        if not validate_username(data['username']):
            errors.append("Username must be 3-30 characters, alphanumeric and underscores only")
    
    if 'bio' in data:
        if not validate_bio(data['bio']):
            errors.append("Bio must be 500 characters or less")
    
    if 'avatar_url' in data:
        if not validate_avatar_url(data['avatar_url']):
            errors.append("Invalid avatar URL format")
    
    return errors

@profile_bp.route('/profile', methods=['PUT'])
def update_profile():
    # Get authenticated user ID from token (assuming you have authentication middleware)
    current_user_id = getattr(g, 'current_user_id', None)
    if not current_user_id:
        return jsonify({"error": "Authentication required"}), 401
    
    # Get JSON data
    data = request.get_json()
    
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    # Validate input against whitelist and constraints
    validation_errors = validate_input(data)
    if validation_errors:
        return jsonify({"errors": validation_errors}), 400
    
    # If no fields to update, return success
    if not data:
        return jsonify({"message": "No updates provided"}), 200
    
    # Build parameterized query with only allowed fields
    set_clauses = []
    values = []
    
    for field in ALLOWED_UPDATE_FIELDS:
        if field in data:
            set_clauses.append(f"{field} = %s")
            values.append(data[field])
    
    if not set_clauses:
        return jsonify({"message": "No valid fields to update"}), 400
    
    # Add user_id for WHERE clause
    values.append(current_user_id)
    
    query = f"UPDATE users SET {', '.join(set_clauses)} WHERE id = %s"
    
    try:
        # Execute parameterized query (assuming you have a database connection function)
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(query, values)
        conn.commit()
        
        if cursor.rowcount == 0:
            return jsonify({"error": "User not found"}), 404
        
        # Return updated profile (you might want to fetch the updated data)
        return jsonify({
            "message": "Profile updated successfully",
            "user_id": current_user_id
        }), 200
    
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()