import os
import hmac
import hashlib
from flask import Flask, request, abort, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.exc import SQLAlchemyError

# -------------------- Configuration --------------------
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'super-secret-key')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv(
    'DATABASE_URL',
    'sqlite:///orders.db'
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
WEBHOOK_SECRET = os.getenv('PAYMENT_WEBHOOK_SECRET', 'change-me-to-a-strong-secret')

db = SQLAlchemy(app)

# -------------------- Database Model --------------------
class Order(db.Model):
    __tablename__ = 'orders'

    id = db.Column(db.Integer, primary_key=True)
    external_id = db.Column(db.String(128), unique=True, nullable=False)  # ID from payment provider
    status = db.Column(db.String(64), nullable=False, default='pending')
    amount_cents = db.Column(db.Integer, nullable=False)
    currency = db.Column(db.String(8), nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'external_id': self.external_id,
            'status': self.status,
            'amount_cents': self.amount_cents,
            'currency': self.currency
        }

# -------------------- Helper Functions --------------------
def verify_signature(payload: bytes, signature_header: str) -> bool:
    """
    Verify HMAC SHA256 signature sent by the payment provider.
    Expected header format: "sha256=hexsignature"
    """
    if not signature_header or not signature_header.startswith('sha256='):
        return False
    received_sig = signature_header.split('=', 1)[1]
    expected_hmac = hmac.new(
        key=WEBHOOK_SECRET.encode(),
        msg=payload,
        digestmod=hashlib.sha256
    ).hexdigest()
    # Use constant-time comparison to mitigate timing attacks
    return hmac.compare_digest(received_sig, expected_hmac)

def get_order_by_external_id(external_id: str):
    return Order.query.filter_by(external_id=external_id).first()

# -------------------- Routes --------------------
@app.route('/webhook/payment', methods=['POST'])
def payment_webhook():
    # 1. Verify signature
    signature = request.headers.get('X-Payment-Signature')
    if not verify_signature(request.data, signature):
        abort(401, description='Invalid webhook signature.')

    # 2. Parse JSON payload
    try:
        event = request.get_json(force=True)
    except Exception:
        abort(400, description='Malformed JSON payload.')

    # Expected payload structure (example):
    # {
    #   "type": "payment.succeeded",
    #   "data": {
    #       "order_id": "ord_12345",
    #       "status": "paid",
    #       "amount_cents": 2500,
    #       "currency": "USD"
    #   }
    # }

    event_type = event.get('type')
    data = event.get('data', {})

    if not event_type or not data:
        abort(400, description='Missing required fields.')

    external_order_id = data.get('order_id')
    new_status = data.get('status')

    if not external_order_id or not new_status:
        abort(400, description='order_id and status are required in payload.')

    # 3. Update order in DB
    try:
        order = get_order_by_external_id(external_order_id)
        if not order:
            # Optionally create the order if it does not exist.
            # Here we choose to abort; adjust as needed.
            abort(404, description='Order not found.')

        # Map provider status to internal status if needed
        status_mapping = {
            'paid': 'completed',
            'failed': 'failed',
            'refunded': 'refunded',
            'canceled': 'canceled'
        }
        order.status = status_mapping.get(new_status.lower(), new_status.lower())
        db.session.commit()
    except SQLAlchemyError as e:
        db.session.rollback()
        abort(500, description='Database error.')

    # 4. Respond to provider
    return jsonify({'status': 'success'}), 200

# -------------------- Application Entry Point --------------------
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(host='0.0.0.0', port=5000)