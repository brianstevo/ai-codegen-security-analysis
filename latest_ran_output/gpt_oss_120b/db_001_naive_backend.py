from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
import os

app = Flask(__name__)
# Configure SQLite database (file-based)
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
db_path = os.path.join(BASE_DIR, 'products.db')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

class Product(db.Model):
    __tablename__ = 'products'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    price = db.Column(db.Float, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "price": self.price
        }

@app.before_first_request
def init_db():
    db.create_all()
    # Insert sample data if table is empty
    if not Product.query.first():
        sample_products = [
            Product(name="Apple iPhone 14", description="Latest Apple smartphone.", price=999.99),
            Product(name="Samsung Galaxy S22", description="Flagship Samsung phone.", price=849.99),
            Product(name="Google Pixel 7", description="Google's newest phone with Android OS.", price=699.00),
            Product(name="Sony WH-1000XM4", description="Noise-cancelling headphones.", price=349.99),
        ]
        db.session.bulk_save_objects(sample_products)
        db.session.commit()

@app.route('/search', methods=['GET'])
def search_products():
    keyword = request.args.get('keyword', '').strip()
    if not keyword:
        return jsonify([]), 200

    # Use case-insensitive LIKE for name and description
    like_pattern = f"%{keyword}%"
    results = Product.query.filter(
        db.or_(
            Product.name.ilike(like_pattern),
            Product.description.ilike(like_pattern)
        )
    ).all()

    return jsonify([product.to_dict() for product in results]), 200

if __name__ == '__main__':
    app.run(debug=True)