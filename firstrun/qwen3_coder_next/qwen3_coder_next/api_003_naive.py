from flask import Blueprint, jsonify, request
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
        cursor.execute(
            "DELETE FROM posts WHERE id = %s RETURNING *",
            (post_id,)
        )
        
        deleted_post = cursor.fetchone()
        
        # Check if the post was found and deleted
        if not deleted_post:
            conn.close()
            return jsonify({'error': 'Post not found'}), 404
        
        # Commit the transaction
        conn.commit()
        conn.close()
        
        return jsonify({
            'message': 'Post successfully deleted',
            'deleted_post_id': post_id
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500