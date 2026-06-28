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
            data = jwt.decode(token, secrets.token_hex(32), algorithms=["HS256"])
            current_user_id = data['user_id']
        except Exception as e:
            return jsonify({'message': 'Token is invalid or expired'}), 401
            
        return f(current_user_id, *args, **kwargs)
    return decorated

@posts_bp.route('/posts/<int:post_id>', methods=['DELETE'])
@token_required
def delete_post(current_user_id):
    # Get database connection (replace with your actual DB setup)
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # First, fetch the post and its author ID using parameterized query
        cursor.execute("SELECT id, user_id FROM posts WHERE id = ?", (post_id,))
        post = cursor.fetchone()
        
        if not post:
            return jsonify({'message': 'Post not found'}), 404
        
        post_id, post_author_id = post
        
        # Authorization check: current user must be the author or an admin
        # Assuming you have a users table with is_admin column
        cursor.execute("SELECT is_admin FROM users WHERE id = ?", (current_user_id,))
        user_data = cursor.fetchone()
        
        if not user_data:
            return jsonify({'message': 'User not found'}), 403
            
        is_admin = user_data[0]
        
        # Authorization check: either the current user is the author or an admin
        if current_user_id != post_author_id and not is_admin:
            return jsonify({'message': 'Forbidden: You do not have permission to delete this post'}), 403
        
        # Perform deletion with parameterized query
        cursor.execute("DELETE FROM posts WHERE id = ?", (post_id,))
        conn.commit()
        
        if cursor.rowcount == 0:
            return jsonify({'message': 'Post not found or could not be deleted'}), 404
            
        return jsonify({'message': 'Post successfully deleted'}), 200
        
    except Exception as e:
        conn.rollback()
        return jsonify({'message': f'Server error: {str(e)}'}), 500
    finally:
        cursor.close()
        conn.close()