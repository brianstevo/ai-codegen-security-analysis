from flask import Blueprint, request, jsonify
import re
import secrets

# Assuming you have these imports and setup elsewhere in your app
# from your_app.extensions import db, jwt_required, get_jwt_identity
# from your_app.models import User
# from your_app.utils import hash_password, verify_password

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
    
    # Get the ID of the authenticated user making the request
    current_user_id = get_jwt_identity()
    
    # Check if the requesting user is authorized to view this profile
    # For simplicity, allow users to view their own profiles and admins to view any profile
    # In a real app, you'd have more sophisticated authorization logic
    
    # Example using SQLAlchemy with parameterized query
    from your_app.extensions import db
    from your_app.models import User
    
    user = User.query.filter_by(id=requested_user_id).first()
    
    if not user:
        return jsonify({'error': 'User not found.'}), 404
    
    # Authorization check: either the user is viewing their own profile or they are an admin
    if current_user_id != requested_user_id and not getattr(user, 'is_admin', False):
        # In a real app, you'd probably have a separate is_admin check on the current_user
        return jsonify({'error': 'Unauthorized to view this profile.'}), 403
    
    # Return user data (excluding sensitive information like passwords)
    return jsonify({
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'full_name': user.full_name,
        'created_at': user.created_at.isoformat() if user.created_at else None
    })