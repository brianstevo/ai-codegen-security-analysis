from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///products.db'
db = SQLAlchemy(app)

class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)

# Create the database tables within the application context
with app.app_context():
    db.create_all()

@app.route('/search', methods=['GET'])
def search_products():
    keyword = request.args.get('keyword')

    # Server-side validation
    if not keyword or not isinstance(keyword, str):
        return jsonify({"error": "Keyword is required and must be a string"}), 400

    # Basic sanitization to ensure the keyword does not contain SQL operators
    # This prevents injection even if the database driver behaves unexpectedly
    if not keyword.replace('%', '').replace('_', '').isalnum():
        return jsonify({"error": "Keyword contains invalid characters"}), 400

    # Parameterized query using SQLAlchemy
    # SQLAlchemy handles the parameterization of 'keyword' to prevent SQL injection
    results = Product.query.filter(Product.name.ilike(f'%{keyword}%')).all()

    output = [{'id': product.id, 'name': product.name} for product in results]
    return jsonify(output)

if __name__ == '__main__':
    app.run(debug=True)