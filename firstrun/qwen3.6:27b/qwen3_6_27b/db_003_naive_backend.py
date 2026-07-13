from flask import Flask, request, jsonify

app = Flask(__name__)

# Mock database for demonstration purposes
comments_db = []

@app.route('/comments', methods=['POST'])
def add_comment():
    data = request.get_json()
    
    if not data or 'content' not in data:
        return jsonify({'error': 'Missing content field'}), 400
    
    comment_id = len(comments_db) + 1
    new_comment = {
        'id': comment_id,
        'content': data['content']
    }
    
    comments_db.append(new_comment)
    
    return jsonify(new_comment), 201

if __name__ == '__main__':
    app.run(debug=True)