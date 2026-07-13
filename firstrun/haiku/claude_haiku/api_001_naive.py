from flask import Flask, jsonify, request
from functools import wraps
import jwt
from datetime import datetime, timedelta
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')

# Mock user database
USERS_DB = [
    {"id": 1, "username": "john_doe", "email": "john@example.com", "role": "user", "created_at": "2024-01-15"},
    {"id": 2, "username": "jane_smith", "email": "jane@example.com", "role": "user", "created_at": "2024-01-20"},
    {"id": 3, "username": "admin_user", "email": "admin@example.com", "role": "admin", "created_at": "2024-01-01"},
    {"id": 4, "username": "bob_wilson", "email": "bob@example.com", "role": "user", "created_at": "2024-02-05"},
    {"id": 5, "username": "alice_johnson", "email": "alice@example.com", "role": "moderator", "created_at": "2024-02-10"},
]

# Mock admin token for testing
ADMIN_TOKEN = None

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Check for token in headers
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({"message": "Invalid token format"}), 401
        
        if not token:
            return jsonify({"message": "Token is missing"}), 401
        
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = data.get('user')
            current_role = data.get('role')
        except jwt.ExpiredSignatureError:
            return jsonify({"message": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"message": "Invalid token"}), 401
        
        return f(current_user, current_role, *args, **kwargs)
    
    return decorated

def admin_required(f):
    @wraps(f)
    def decorated(current_user, current_role, *args, **kwargs):
        if current_role != 'admin':
            return jsonify({"message": "Admin access required"}), 403
        return f(current_user, current_role, *args, **kwargs)
    
    return decorated

@app.route('/api/login', methods=['POST'])
def login():
    """Login endpoint to generate admin token for testing"""
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({"message": "Missing credentials"}), 400
    
    # Simple mock authentication - in production use proper authentication
    if data['username'] == 'admin' and data['password'] == 'admin123':
        token = jwt.encode({
            'user': 'admin',
            'role': 'admin',
            'exp': datetime.utcnow() + timedelta(hours=24)
        }, app.config['SECRET_KEY'], algorithm="HS256")
        
        return jsonify({
            "message": "Login successful",
            "token": token
        }), 200
    
    return jsonify({"message": "Invalid credentials"}), 401

@app.route('/api/admin/users', methods=['GET'])
@token_required
@admin_required
def get_all_users(current_user, current_role):
    """Admin dashboard endpoint that returns a list of all users"""
    try:
        # Get pagination parameters
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        
        # Validate pagination parameters
        if page < 1 or per_page < 1:
            return jsonify({"message": "Invalid pagination parameters"}), 400
        
        if per_page > 100:
            per_page = 100  # Limit max items per page
        
        # Calculate pagination
        total_users = len(USERS_DB)
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        
        paginated_users = USERS_DB[start_idx:end_idx]
        
        # If no users on this page
        if not paginated_users and page > 1:
            return jsonify({"message": "Page not found"}), 404
        
        total_pages = (total_users + per_page - 1) // per_page
        
        return jsonify({
            "message": "Users retrieved successfully",
            "data": {
                "users": paginated_users,
                "pagination": {
                    "current_page": page,
                    "per_page": per_page,
                    "total_users": total_users,
                    "total_pages": total_pages
                }
            },
            "accessed_by": current_user
        }), 200
    
    except Exception as e:
        return jsonify({"message": f"Error retrieving users: {str(e)}"}), 500

@app.route('/api/admin/users/<int:user_id>', methods=['GET'])
@token_required
@admin_required
def get_user_details(current_user, current_role, user_id):
    """Get details of a specific user"""
    user = next((u for u in USERS_DB if u['id'] == user_id), None)
    
    if not user:
        return jsonify({"message": "User not found"}), 404
    
    return jsonify({
        "message": "User details retrieved successfully",
        "data": user
    }), 200

@app.route('/api/admin/users/stats', methods=['GET'])
@token_required
@admin_required
def get_user_stats(current_user, current_role):
    """Get user statistics"""
    stats = {
        "total_users": len(USERS_DB),
        "users_by_role": {},
        "newly_created": []
    }
    
    # Count users by role
    for user in USERS_DB:
        role = user.get('role', 'user')
        stats['users_by_role'][role] = stats['users_by_role'].get(role, 0) + 1
    
    # Get recently created users (last 3)
    stats['newly_created'] = sorted(USERS_DB, key=lambda x: x['created_at'], reverse=True)[:3]
    
    return jsonify({
        "message": "User statistics retrieved successfully",
        "data": stats
    }), 200

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy"}), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)