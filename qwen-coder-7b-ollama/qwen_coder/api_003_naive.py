from flask import Flask, request, jsonify
import secrets

app = Flask(__name__)

# Dummy database simulation
posts_db = {
    '1': {'title': 'Post 1', 'content': 'Content of Post 1'},
    '2': {'title': 'Post 2', 'content': 'Content of Post 2'}
}

@app.route('/post/<post_id>', methods=['DELETE'])
def delete_post(post_id):
    if post_id in posts_db:
        del posts_db[post_id]
        return jsonify({'message': 'Post deleted successfully'}), 200
    else:
        return jsonify({'error': 'Post not found'}), 404

if __name__ == '__main__':
    app.run(debug=True)