from flask import Flask, request, jsonify
from flask_cors import CORS
from anthropic import Anthropic

app = Flask(__name__)
CORS(app)

# Initialize Anthropic client
client = Anthropic()

# In-memory database for demonstration
users_db = {
    "user123": {
        "id": "user123",
        "name": "John Doe",
        "email": "john@example.com",
        "bio": "Software developer",
        "avatar_url": "https://example.com/avatar.jpg"
    }
}

# Conversation history for multi-turn interactions
conversation_history = []


def get_ai_response(user_message: str) -> str:
    """Get response from Claude about database operations."""
    conversation_history.append({
        "role": "user",
        "content": user_message
    })
    
    response = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=1024,
        system="""You are a helpful database assistant that helps with user profile management operations. 
        When users ask to update profiles, acknowledge what fields will be updated and provide confirmation of the changes.
        Be concise and professional in your responses.""",
        messages=conversation_history
    )
    
    assistant_message = response.content[0].text
    conversation_history.append({
        "role": "assistant",
        "content": assistant_message
    })
    
    return assistant_message


@app.route('/api/users/<user_id>', methods=['PUT'])
def update_user_profile(user_id: str):
    """
    PUT route to update user profile.
    
    Expected JSON body:
    {
        "name": "New Name",
        "email": "new@example.com",
        "bio": "Updated bio",
        "avatar_url": "https://example.com/new_avatar.jpg"
    }
    """
    # Check if user exists
    if user_id not in users_db:
        return jsonify({"error": f"User {user_id} not found"}), 404
    
    # Get JSON data from request
    data = request.get_json()
    
    if not data:
        return jsonify({"error": "Request body must contain JSON data"}), 400
    
    # Get current user for comparison
    current_user = users_db[user_id]
    updated_fields = {}
    
    # List of allowed fields to update
    allowed_fields = ['name', 'email', 'bio', 'avatar_url']
    
    # Update allowed fields only
    for field in allowed_fields:
        if field in data:
            new_value = data[field]
            if new_value != current_user.get(field):
                updated_fields[field] = {
                    "old": current_user.get(field),
                    "new": new_value
                }
                current_user[field] = new_value
    
    # If no valid fields were provided
    if not updated_fields:
        return jsonify({
            "message": "No changes made",
            "user": current_user
        }), 200
    
    # Get AI response about the update
    update_summary = ", ".join([f"{k}: {v['old']} -> {v['new']}" for k, v in updated_fields.items()])
    ai_message = f"User {user_id} profile was updated with changes: {update_summary}"
    
    try:
        ai_response = get_ai_response(ai_message)
    except Exception as e:
        ai_response = f"Profile updated successfully. Changes: {update_summary}"
    
    return jsonify({
        "message": "User profile updated successfully",
        "user_id": user_id,
        "updated_fields": updated_fields,
        "updated_user": current_user,
        "ai_confirmation": ai_response
    }), 200


@app.route('/api/users/<user_id>', methods=['GET'])
def get_user_profile(user_id: str):
    """GET route to retrieve user profile."""
    if user_id not in users_db:
        return jsonify({"error": f"User {user_id} not found"}), 404
    
    return jsonify(users_db[user_id]), 200


@app.route('/api/users', methods=['POST'])
def create_user():
    """POST route to create a new user."""
    data = request.get_json()
    
    if not data or 'id' not in data or 'name' not in data or 'email' not in data:
        return jsonify({"error": "Missing required fields: id, name, email"}), 400
    
    user_id = data['id']
    
    if user_id in users_db:
        return jsonify({"error": f"User {user_id} already exists"}), 409
    
    new_user = {
        "id": user_id,
        "name": data['name'],
        "email": data['email'],
        "bio": data.get('bio', ''),
        "avatar_url": data.get('avatar_url', '')
    }
    
    users_db[user_id] = new_user
    
    # Get AI confirmation
    ai_message = f"New user created: {data['name']} with email {data['email']}"
    try:
        ai_response = get_ai_response(ai_message)
    except Exception as e:
        ai_response = "User created successfully"
    
    return jsonify({
        "message": "User created successfully",
        "user": new_user,
        "ai_confirmation": ai_response
    }), 201


@app.route('/api/chat', methods=['POST'])
def chat():
    """Endpoint for multi-turn conversations about user management."""
    data = request.get_json()
    
    if not data or 'message' not in data:
        return jsonify({"error": "Request body must contain 'message' field"}), 400
    
    user_message = data['message']
    
    try:
        response = get_ai_response(user_message)
        return jsonify({
            "message": response,
            "conversation_history": conversation_history
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/users/<user_id>', methods=['DELETE'])
def delete_user(user_id: str):
    """DELETE route to remove a user."""
    if user_id not in users_db:
        return jsonify({"error": f"User {user_id} not found"}), 404
    
    deleted_user = users_db.pop(user_id)
    
    # Get AI confirmation
    ai_message = f"User {user_id} ({deleted_user['name']}) has been deleted from the database"
    try:
        ai_response = get_ai_response(ai_message)
    except Exception as e:
        ai_response = "User deleted successfully"
    
    return jsonify({
        "message": "User deleted successfully",
        "deleted_user": deleted_user,
        "ai_confirmation": ai_response
    }), 200


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({"status": "healthy"}), 200


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)