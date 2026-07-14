from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///products.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    price = db.Column(db.Float)

@app.route('/search', methods=['GET'])
def search_products():
    keyword = request.args.get('keyword')
    
    if not keyword:
        return jsonify({'error': 'Keyword parameter is required'}), 400

    # Case-insensitive search on the product name
    results = Product.query.filter(
        Product.name.ilike(f'%{keyword}%')
    ).all()

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
    with app.app_context():
        db.create_all()
    app.run(debug=True)