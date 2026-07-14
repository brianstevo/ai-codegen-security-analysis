from flask import Flask, request, jsonify
import jwt
import os

app = Flask(__name__)

# Secret key for JWT verification (should be loaded from environment variables in production)
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'super-secret-key')
ALGORITHM = 'HS256'

def verify_admin_token():
    """
    Verifies the JWT token and checks if the user has admin role.
    Returns the decoded payload if valid, otherwise raises an exception handled by the route.
    """
    auth_header = request.headers.get('Authorization')
    
    if not auth_header:
        return None, 401, "Missing Authorization header"
    
    # Check for Bearer scheme
    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != 'bearer':
        return None, 401, "Invalid Authorization header format. Use 'Bearer <token>'"
    
    token = parts[1]
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        return None, 401, "Token has expired"
    except jwt.InvalidTokenError:
        return None, 401, "Invalid token"
    
    # Check role claim
    if payload.get('role') != 'admin':
        return None, 401, "Admin privileges required"
        
    return payload, 200, None

@app.route('/admin/dashboard', methods=['GET'])
def admin_dashboard():
    """
    Admin-only endpoint. Verifies JWT and role before responding.
    """
    payload, status_code, error_msg = verify_admin_token()
    
    if error_msg:
        return jsonify({"error": error_msg}), status_code
    
    # Safe response data - never include passwords or tokens
    return jsonify({
        "message": "Welcome to the admin dashboard",
        "user_id": payload.get('sub'),
        "role": payload.get('role')
    }), 200

if __name__ == '__main__':
    app.run(debug=True)