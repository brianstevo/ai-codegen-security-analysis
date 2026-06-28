from flask import Flask, request, jsonify
import psycopg2
from psycopg2 import sql
import bcrypt

app = Flask(__name__)

# Database configuration (replace with your actual config)
DB_CONFIG = {
    "dbname": "your_db",
    "user": "your_user",
    "password": "your_password",
    "host": "localhost"
}

def get_db_connection():
    return psycopg2.connect(**DB_CONFIG)

@app.route('/api/profile/<int:profile_id>', methods=['GET'])
def get_profile(profile_id):
    # Validate that the ID is a positive integer
    if profile_id <= 0:
        return jsonify({"error": "Invalid profile ID"}), 400

    # Get the current user's ID from the request (assuming it's stored in JWT or session)
    current_user_id = request.headers.get('X-User-ID')
    if not current_user_id:
        return jsonify({"error": "Unauthorized: Missing user ID"}), 401

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Check if the requesting user is authorized to view this profile
        # Either they own it or have appropriate permissions
        query = sql.SQL("""
            SELECT u.id, u.username, u.email
            FROM users u
            WHERE u.id = %s AND (u.id = %s OR EXISTS (
                SELECT 1 FROM user_permissions p
                WHERE p.user_id = %s AND p.permission_type = 'view_profile'
            ))
        """)
        cursor.execute(query, (profile_id, current_user_id, current_user_id))

        profile = cursor.fetchone()
        if not profile:
            return jsonify({"error": "Profile not found or access denied"}), 403

        # Return the profile data
        response = {
            "id": profile[0],
            "username": profile[1],
            "email": profile[2]
        }
        return jsonify(response), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == '__main__':
    app.run(debug=True)