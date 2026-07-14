import os
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from functools import wraps
import jwt
from datetime import datetime, timedelta

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'super-secret-dev-key')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///bank.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# --- Models ---
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)

class Account(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    balance = db.Column(db.Numeric(precision=12, scale=2), nullable=False, default=0.00)

# --- Auth Decorator ---
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        
        try:
            # Expecting "Bearer <token>"
            token_str = token.split(" ")[1] if " " in token else token
            data = jwt.decode(token_str, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = User.query.get(data['user_id'])
            if not current_user:
                raise Exception("User not found")
        except Exception as e:
            return jsonify({'message': 'Token is invalid or expired!'}), 401
        
        return f(current_user, *args, **kwargs)
    return decorated

# --- Route ---
@app.route('/transfer', methods=['POST'])
@token_required
def transfer_funds(current_user):
    """
    Handles fund transfers between accounts.
    Expected JSON: { "from_account_id": int, "to_account_id": int, "amount": float }
    """
    data = request.get_json()

    if not data:
        return jsonify({'error': 'Missing request body'}), 400

    from_id = data.get('from_account_id')
    to_id = data.get('to_account_id')
    amount = data.get('amount')

    # Basic validation
    if not all([from_id, to_id, amount]):
        return jsonify({'error': 'Missing required fields: from_account_id, to_account_id, amount'}), 400

    try:
        amount = float(amount)
        if amount <= 0:
            return jsonify({'error': 'Transfer amount must be positive'}), 400
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid amount format'}), 400

    try:
        # Use a transaction to ensure atomicity and prevent race conditions
        with db.session.begin_nested():
            # Lock the source account row for update to prevent double-spending (Concurrent access)
            source_acc = Account.query.filter_by(id=from_id).with_for_update().first()
            dest_acc = Account.query.filter_by(id=to_id).with_for_update().first()

            if not source_acc or not dest_acc:
                return jsonify({'error': 'One or both accounts not found'}), 404

            # Authorization check: Ensure the authenticated user owns the source account
            if source_acc.user_id != current_user.id:
                return jsonify({'error': 'Unauthorized to transfer from this account'}), 403

            # Balance check
            if source_acc.balance < amount:
                return jsonify({'error': 'Insufficient funds'}), 400

            # Perform the transfer
            source_acc.balance -= amount
            dest_acc.balance += amount

        db.session.commit()
        return jsonify({
            'message': 'Transfer successful',
            'new_balance': float(source_acc.balance)
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'An internal error occurred during the transaction'}), 500

# --- Initialization (For Demo Purposes) ---
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        # Setup dummy data if empty
        if not User.query.first():
            u1 = User(username="alice")
            u2 = User(username="bob")
            db.session.add_all([u1, u2])
            db.session.commit()
            db.session.add_all([Account(user_id=u1.id, balance=1000.00), 
                                Account(user_id=u2.id, balance=500.00)])
            db.session.commit()
    app.run(debug=True)