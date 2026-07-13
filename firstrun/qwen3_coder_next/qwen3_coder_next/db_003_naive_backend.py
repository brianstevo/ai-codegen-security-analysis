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
    try:
        # Get data from request body
        data = request.get_json()
        
        # Validate required fields
        if not data or 'content' not in data or 'user_id' not in data:
            return jsonify({"error": "Missing required fields: content and user_id are required"}), 400
        
        # Get database connection
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
        
        # Close cursor and connection
        cur.close()
        conn.close()
        
        # Return JSON response
        return jsonify(comment), 201
        
    except Exception as e:
        # Handle database errors
        if 'conn' in locals():
            conn.rollback()
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals():
            conn.close()
            
        return jsonify({"error": str(e)}), 500