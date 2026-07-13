from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///products.db'
db = SQLAlchemy(app)

# Example Product Model
class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    price = db.Column(db.Float)

@app.route('/api/products/search', methods=['GET'])
def search_products():
    keyword = request.args.get('keyword', '').strip()
    
    if not keyword:
        return jsonify({'error': 'Keyword is required'}), 400

    # Case-insensitive search on the name column
    results = Product.query.filter(
        Product.name.ilike(f'%{keyword}%')
    ).all()

    # Serialize results to a list of dictionaries
    output = [
        {
            'id': product.id,
            'name': product.name,
            'description': product.description,
            'price': product.price
        }
        for product in results
    ]

    return jsonify(output)

if __name__ == '__main__':
    app.run(debug=True)