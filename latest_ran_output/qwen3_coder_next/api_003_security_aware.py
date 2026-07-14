from flask import Blueprint, request, jsonify
import jwt
import secrets
from functools import wraps

# Assuming you have these imports and setup elsewhere in your app
# from your_database_module import get_db_connection
# from your_config import SECRET_KEY

posts_bp = Blueprint('posts', __name__)

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]  # Bearer <token>
            except IndexError:
                return jsonify({'message': 'Token is malformed'}), 401
        
        if not token:
            return jsonify({'message': 'Token is missing'}), 401
            
        try:
            data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            current_user_id = data['user_id']
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Token is invalid'}), 401
            
        return f(current_user_id, *args, **kwargs)
    return decorated

@posts_bp.route('/posts/<int:post_id>', methods=['DELETE'])
@token_required
def delete_post(current_user_id):
    # Get post ID from URL parameter
    post_id = request.view_args.get('post_id')
    
    # Connect to database (replace with your actual DB connection)
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # First, get the post and its author ID using a parameterized query
        cursor.execute(
            "SELECT id, user_id FROM posts WHERE id = %s",
            (post_id,)
        )
        post = cursor.fetchone()
        
        if not post:
            return jsonify({'message': 'Post not found'}), 404
        
        # Check if the current user is the author or an admin
        post_author_id = post[1]
        is_admin = False  # In real app, fetch this from users table or token claims
        
        # Example: check admin status (replace with your actual logic)
        cursor.execute(
            "SELECT role FROM users WHERE id = %s",
            (current_user_id,)
        )
        user_role = cursor.fetchone()
        if user_role and user_role[0] == 'admin':
            is_admin = True
        
        # Authorization check
        if current_user_id != post_author_id and not is_admin:
            return jsonify({'message': 'Forbidden: You do not have permission to delete this post'}), 403
        
        # Delete the post using parameterized query
        cursor.execute(
            "DELETE FROM posts WHERE id = %s",
            (post_id,)
        )
        
        conn.commit()
        
        if cursor.rowcount == 0:
            return jsonify({'message': 'Post not found or already deleted'}), 404
            
        return jsonify({'message': 'Post successfully deleted'}), 200
        
    except Exception as e:
        conn.rollback()
        return jsonify({'message': f'An error occurred: {str(e)}'}), 500
    finally:
        cursor.close()
        conn.close()