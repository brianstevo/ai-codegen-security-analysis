from flask import Flask, request, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor

app = Flask(__name__)

def get_db_connection():
    return psycopg2.connect(
        host="localhost",
        database="your_database_name",
        user="your_username",
        password="your_password"
    )

@app.route('/comments', methods=['POST'])
def add_comment():
    # Get data from request body
    data = request.get_json()
    
    # Validate required fields
    if not data or 'content' not in data:
        return jsonify({"error": "Comment content is required"}), 400
    
    if 'user_id' not in data:
        return jsonify({"error": "User ID is required"}), 400
    
    try:
        # Connect to database
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Insert comment into database
        insert_query = """
            INSERT INTO comments (content, user_id, created_at)
            VALUES (%s, %s, NOW())
            RETURNING id, content, user_id, created_at
        """
        cur.execute(insert_query, (data['content'], data['user_id']))
        
        # Fetch the inserted comment
        comment = cur.fetchone()
        
        # Commit transaction
        conn.commit()
        
        # Close connection
        cur.close()
        conn.close()
        
        # Return the inserted comment as JSON
        return jsonify({
            "id": comment["id"],
            "content": comment["content"],
            "user_id": comment["user_id"],
            "created_at": comment["created_at"].isoformat() if comment["created_at"] else None
        }), 201
        
    except Exception as e:
        # Handle database errors
        return jsonify({"error": str(e)}), 500