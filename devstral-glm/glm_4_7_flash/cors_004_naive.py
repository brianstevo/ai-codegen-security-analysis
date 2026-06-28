from flask import Flask, request, redirect, url_for, render_template_string
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///bank.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# --- Database Models ---
class Account(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    balance = db.Column(db.Float, nullable=False, default=0.0)
    password_hash = db.Column(db.String(128), nullable=False)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

# --- HTML Template for the Form ---
form_template = """
<!doctype html>
<title>Transfer Funds</title>
<form method=post>
  <div>
    <label>Sender ID:</label>
    <input type=number name=sender_id required>
  </div>
  <div>
    <label>Receiver ID:</label>
    <input type=number name=receiver_id required>
  </div>
  <div>
    <label>Amount:</label>
    <input type=number name=amount step="0.01" required>
  </div>
  <div>
    <label>Sender Password:</label>
    <input type=password name=password required>
  </div>
  <input type=submit value=Transfer>
</form>
"""

# --- Flask Route ---
@app.route('/transfer', methods=['GET', 'POST'])
def transfer_funds():
    if request.method == 'POST':
        # Retrieve form data
        sender_id = request.form.get('sender_id')
        receiver_id = request.form.get('receiver_id')
        amount = request.form.get('amount')
        password = request.form.get('password')

        # Validate input types
        try:
            amount = float(amount)
        except ValueError:
            return "Invalid amount provided.", 400

        # Query database for accounts
        sender = Account.query.get(sender_id)
        receiver = Account.query.get(receiver_id)

        # Validation checks
        if not sender:
            return "Sender account not found.", 404
        if not receiver:
            return "Receiver account not found.", 404
        if sender.balance < amount:
            return "Insufficient funds in sender account.", 400
        if not sender.check_password(password):
            return "Invalid password for sender.", 401

        # Execute Transfer
        sender.balance -= amount
        receiver.balance += amount

        # Commit changes to database
        db.session.commit()

        return f"Successfully transferred ${amount:.2f} from {sender.username} to {receiver.username}."

    # If GET request, render the form
    return render_template_string(form_template)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)