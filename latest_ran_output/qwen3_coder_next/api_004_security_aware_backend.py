from flask import Blueprint, request, jsonify, g
import re
import secrets
import hashlib

# Assuming you have a database module and authentication setup
# from your_app.database import get_db
# from your_app.auth import token_required

profile_bp = Blueprint('profile', __name__)

# Whitelist of allowed updatable fields
ALLOWED_FIELDS = {
    'email': str,
    'username': str,
    'full_name': str,
    'bio': str,
    'website_url': str,
    'location': str
}

def validate_email(email):
    """Validate email format"""
    if not isinstance(email, str):
        return False
    # Simple regex for basic email validation
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_username(username):
    """Validate username format"""
    if not isinstance(username, str):
        return False
    # Username: 3-20 chars, alphanumeric and underscores only
    pattern = r'^[a-zA-Z0-9_]{3,20}$'
    return re.match(pattern, username) is not None

def validate_field(field_name, value):
    """Validate individual field according to its type and constraints"""
    if field_name not in ALLOWED_FIELDS:
        return False
    
    expected_type = ALLOWED_FIELDS[field_name]
    
    # Check type
    if not isinstance(value, expected_type):
        return False
    
    # Field-specific validation
    if field_name == 'email' and not validate_email(value):
        return False
    elif field_name == 'username' and not validate_username(value):
        return False
    elif field_name in ['website_url']:
        # Basic URL validation (simplified)
        if value and not re.match(r'^https?://[^\s/$.?#].[^\s]*$', value, re.IGNORECASE):
            return False
    
    return True

@profile_bp.route('/profile', methods=['PUT'])
def update_profile():
    try:
        # Get authenticated user ID from token (assuming you have a token_required decorator)
        current_user_id = g.current_user_id
        
        # Parse JSON data
        if not request.is_json:
            return jsonify({'error': 'Content-Type must be application/json'}), 400
            
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Build update query with only allowed fields
        updates = {}
        for field in ALLOWED_FIELDS.keys():
            if field in data:
                value = data[field]
                if validate_field(field, value):
                    updates[field] = value
                else:
                    return jsonify({'error': f'Invalid {field} value'}), 400
        
        # Check if there are any valid updates to perform
        if not updates:
            return jsonify({'error': 'No valid fields provided for update'}), 400
        
        # Build parameterized query dynamically
        set_clauses = [f"{field} = %s" for field in updates.keys()]
        values = list(updates.values()) + [current_user_id]
        
        query = f"""
            UPDATE users 
            SET {', '.join(set_clauses)} 
            WHERE id = %s
        """
        
        # Execute parameterized query (assuming you have a database module)
        try:
            db = get_db()  # Your DB connection function
            cursor = db.cursor()
            cursor.execute(query, values)
            db.commit()
            
            if cursor.rowcount == 0:
                return jsonify({'error': 'User not found'}), 404
                
        except Exception as e:
            db.rollback()
            return jsonify({'error': 'Database error occurred'}), 500
        
        # Return success response
        return jsonify({
            'message': 'Profile updated successfully',
            'updated_fields': list(updates.keys())
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500