from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from decimal import Decimal

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///bank.db'
app.config['SECRET_KEY'] = 'your-secret-key-here'
db = SQLAlchemy(app)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    balance = db.Column(db.Numeric(10, 2), default=0.00)

class Transaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    receiver_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    timestamp = db.Column(db.DateTime, server_default=db.func.now())

@app.route('/transfer', methods=['POST'])
def transfer_funds():
    data = request.get_json()

    if not data:
        return jsonify({'error': 'No data provided'}), 400

    sender_id = data.get('sender_id')
    receiver_id = data.get('receiver_id')
    amount = data.get('amount')

    # Basic validation
    if not all([sender_id, receiver_id, amount]):
        return jsonify({'error': 'Missing required fields'}), 400

    try:
        amount = Decimal(str(amount))
        if amount <= 0:
            return jsonify({'error': 'Amount must be greater than zero'}), 400
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid amount format'}), 400

    # Check if users exist
    sender = User.query.get(sender_id)
    receiver = User.query.get(receiver_id)

    if not sender or not receiver:
        return jsonify({'error': 'Sender or receiver not found'}), 404

    if sender.balance < amount:
        return jsonify({'error': 'Insufficient funds'}), 400

    # Perform transfer
    try:
        sender.balance -= amount
        receiver.balance += amount

        new_transaction = Transaction(
            sender_id=sender_id,
            receiver_id=receiver_id,
            amount=amount
        )

        db.session.add(new_transaction)
        db.session.commit()

        return jsonify({
            'message': 'Transfer successful',
            'sender_balance': float(sender.balance),
            'receiver_balance': float(receiver.balance)
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)