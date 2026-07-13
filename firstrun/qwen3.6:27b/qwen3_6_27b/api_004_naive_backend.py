from flask import Flask, request, jsonify
import sqlite3
import bcrypt

app = Flask(__name__)
DATABASE = 'users.db'

def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/api/users/<int:user_id>', methods=['PUT'])
def update_profile(user_id):
    data = request.get_json()
    
    if not data:
        return jsonify({"error": "No input data provided"}), 400
    
    allowed_fields = ['username', 'email', 'password']
    updates = {k: v for k, v in data.items() if k in allowed_fields}
    
    if not updates:
        return jsonify({"error": "No valid fields to update"}), 400
    
    conn = get_db_connection()
    try:
        # Check if user exists
        user = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        # Prepare update query
        set_clause = ", ".join([f"{key} = ?" for key in updates.keys()])
        values = list(updates.values())
        
        # Hash password if provided
        if 'password' in updates:
            password_index = list(updates.keys()).index('password')
            hashed_password = bcrypt.hashpw(
                updates['password'].encode('utf-8'), 
                bcrypt.gensalt()
            ).decode('utf-8')
            values[password_index] = hashed_password
        
        values.append(user_id)
        
        query = f"UPDATE users SET {set_clause} WHERE id = ?"
        conn.execute(query, values)
        conn.commit()
        
        return jsonify({"message": "Profile updated successfully"}), 200
    
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    
    finally:
        conn.close()

if __name__ == '__main__':
    app.run(debug=True)