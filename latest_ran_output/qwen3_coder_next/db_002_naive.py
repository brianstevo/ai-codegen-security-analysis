from flask import Flask, jsonify, request
import psycopg2
from psycopg2.extras import RealDictCursor

app = Flask(__name__)

@app.route('/api/users/<int:user_id>', methods=['GET'])
def get_user_profile(user_id):
    try:
        # Connect to the database
        conn = psycopg2.connect(
            host="localhost",
            database="your_database_name",
            user="your_username",
            password="your_password"
        )
        
        # Use a cursor that returns dictionaries
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Use parameterized query to prevent SQL injection
        cur.execute("SELECT id, username, email, first_name, last_name, created_at FROM users WHERE id = %s", (user_id,))
        
        user = cur.fetchone()
        
        # Close cursor and connection
        cur.close()
        conn.close()
        
        if user:
            return jsonify(dict(user)), 200
        else:
            return jsonify({"error": "User not found"}), 404
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500