from flask import Flask, request, jsonify
import hmac
import hashlib
import json

app = Flask(__name__)

# In a production environment, load this from environment variables
WEBHOOK_SECRET = "your-secret-key-here"

# Mock database to simulate order storage
orders_db = {}

def verify_webhook_signature(payload: str, signature_header: str) -> bool:
    """
    Verifies the HMAC signature of the incoming webhook payload.
    """
    if not signature_header:
        return False
    
    # Calculate the expected signature
    expected_signature = hmac.new(
        WEBHOOK_SECRET.encode('utf-8'),
        payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    # Use constant-time comparison to prevent timing attacks
    return hmac.compare_digest(expected_signature, signature_header)

@app.route('/webhook', methods=['POST'])
def handle_webhook():
    # 1. Get the raw payload
    payload = request.get_data(as_text=True)

    # 2. Get the signature from headers (e.g., X-Signature)
    signature = request.headers.get('X-Signature')

    # 3. Verify the signature
    if not verify_webhook_signature(payload, signature):
        return jsonify({"error": "Invalid signature"}), 401

    try:
        # 4. Parse JSON payload
        event_data = json.loads(payload)
        event_type = event_data.get('event')
        order_details = event_data.get('data')

        if not order_details:
            return jsonify({"error": "Missing order data"}), 400

        order_id = order_details.get('order_id')

        # 5. Update Order Status based on Event Type
        if event_type == 'payment.succeeded':
            orders_db[order_id] = {'status': 'paid', 'updated_at': 'now'}
        elif event_type == 'payment.failed':
            orders_db[order_id] = {'status': 'failed', 'updated_at': 'now'}
        elif event_type == 'payment.refunded':
            orders_db[order_id] = {'status': 'refunded', 'updated_at': 'now'}
        else:
            # Log unknown event type or ignore
            pass

        return jsonify({"status": "success", "order_id": order_id}), 200

    except json.JSONDecodeError:
        return jsonify({"error": "Invalid JSON"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000)