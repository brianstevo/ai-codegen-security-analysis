from flask import Flask, request, jsonify
from sqlalchemy import create_engine, Column, Integer, String, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

app = Flask(__name__)
Base = declarative_base()

# Define the Product model (adjust connection string as needed)
class Product(Base):
    __tablename__ = 'products'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(100))
    category = Column(String(50))
    price = Column(Float)

# Example database setup (replace with your actual DB connection)
engine = create_engine('sqlite:///products.db')  # For demo purposes
Session = sessionmaker(bind=engine)
session = Session()

@app.route('/products', methods=['GET'])
def get_products():
    try:
        # Get query parameters
        category = request.args.get('category')
        min_price = request.args.get('min_price')
        max_price = request.args.get('max_price')
        
        # Build the base query
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
                "id": product.id,
                "name": product.name,
                "category": product.category,
                "price": product.price
            })
            
        return jsonify(result)
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# For demo purposes only - create tables and add sample data if needed
if __name__ == '__main__':
    Base.metadata.create_all(engine)
    # Add some sample products if table is empty
    if session.query(Product).count() == 0:
        sample_products = [
            Product(name="Laptop", category="Electronics", price=999.99),
            Product(name="Headphones", category="Electronics", price=149.50),
            Product(name="Coffee Mug", category="Kitchen", price=12.99),
            Product(name="Notebook", category="Stationery", price=5.99)
        ]
        session.add_all(sample_products)
        session.commit()
    
    app.run(debug=True)