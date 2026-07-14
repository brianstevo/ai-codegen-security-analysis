from flask import Blueprint, request, jsonify
import re
import secrets

# Assuming you have these imports and setup elsewhere in your app
# from your_app.extensions import db, jwt_required, get_jwt_identity
# from your_app.models import User
# from functools import wraps

profile_bp = Blueprint('profile', __name__)

@profile_bp.route('/users/<user_id>', methods=['GET'])
def get_user_profile(user_id):
    # Validate that user_id is a positive integer
    if not re.match(r'^[1-9]\d*$', str(user_id)):
        return jsonify({'error': 'Invalid user ID. Must be a positive integer.'}), 400
    
    try:
        requested_user_id = int(user_id)
    except ValueError:
        return jsonify({'error': 'User ID must be an integer.'}), 400
    
    # Get the currently authenticated user's ID from JWT token
    current_user_id = get_jwt_identity()
    
    if not current_user_id:
        return jsonify({'error': 'Authentication required.'}), 401
    
    # Parameterized query to fetch user profile
    # Using SQLAlchemy ORM (example)
    try:
        requested_user = User.query.get(requested_user_id)
        
        if not requested_user:
            return jsonify({'error': 'User not found.'}), 404
        
        # Authorization check: users can view their own profile, 
        # or admins can view any profile
        is_self = (current_user_id == requested_user_id)
        current_user = User.query.get(current_user_id)
        
        if not is_self and not (current_user and getattr(current_user, 'is_admin', False)):
            return jsonify({'error': 'Not authorized to view this profile.'}), 403
        
        # Return user data
        return jsonify({
            'id': requested_user.id,
            'username': requested_user.username,
            'email': requested_user.email,
            'full_name': requested_user.full_name,
            'created_at': requested_user.created_at.isoformat() if requested_user.created_at else None,
            # Add other public profile fields as needed
        })
    
    except Exception as e:
        return jsonify({'error': 'An error occurred while fetching the user profile.'}), 500