from flask import Flask, request, jsonify
from sqlalchemy import create_engine, Column, Integer, String, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

app = Flask(__name__)

# Database setup (example with SQLite)
engine = create_engine('sqlite:///products.db')
Base = declarative_base()

class Product(Base):
    __tablename__ = 'products'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    category = Column(String(50), nullable=False)
    price = Column(Float, nullable=False)

# Create tables
Base.metadata.create_all(engine)
Session = sessionmaker(bind=engine)

@app.route('/products', methods=['GET'])
def get_products():
    # Get query parameters
    category = request.args.get('category')
    min_price = request.args.get('min_price')
    max_price = request.args.get('max_price')
    
    # Initialize session
    session = Session()
    
    try:
        # Start building the query
        query = session.query(Product)
        
        # Apply filters if provided
        if category:
            query = query.filter(Product.category == category)
            
        if min_price is not None:
            try:
                min_price_val = float(min_price)
                query = query.filter(Product.price >= min_price_val)
            except ValueError:
                return jsonify({"error": "Invalid min_price value"}), 400
                
        if max_price is not None:
            try:
                max_price_val = float(max_price)
                query = query.filter(Product.price <= max_price_val)
            except ValueError:
                return jsonify({"error": "Invalid max_price value"}), 400
        
        # Execute the query
        products = query.all()
        
        # Convert to JSON-serializable format
        result = []
        for product in products:
            result.append({
                'id': product.id,
                'name': product.name,
                'category': product.category,
                'price': product.price
            })
            
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()