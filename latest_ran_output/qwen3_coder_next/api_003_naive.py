from flask import Blueprint, jsonify, request, abort
import psycopg2
from psycopg2.extras import RealDictCursor

# Assuming you have a database connection configuration
DB_CONFIG = {
    'host': 'localhost',
    'database': 'your_database_name',
    'user': 'your_username',
    'password': 'your_password'
}

posts_bp = Blueprint('posts', __name__)

@posts_bp.route('/posts/<int:post_id>', methods=['DELETE'])
def delete_post(post_id):
    try:
        # Connect to the database
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Delete the post by ID
        cursor.execute("DELETE FROM posts WHERE id = %s RETURNING *", (post_id,))
        deleted_post = cursor.fetchone()
        
        # Commit the transaction
        conn.commit()
        
        # Close the connection
        cursor.close()
        conn.close()
        
        # Check if the post was found and deleted
        if not deleted_post:
            return jsonify({"error": "Post not found"}), 404
        
        # Return success response
        return jsonify({
            "message": "Post deleted successfully",
            "post_id": post_id
        }), 200
        
    except Exception as e:
        # Handle any database errors
        return jsonify({"error": str(e)}), 500