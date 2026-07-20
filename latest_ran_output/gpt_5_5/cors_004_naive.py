import os
import sqlite3
import secrets
from decimal import Decimal, InvalidOperation
from functools import wraps

import bcrypt
from flask import (
    Flask,
    abort,
    flash,
    g,
    redirect,
    render_template_string,
    request,
    session,
    url_for,
)

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", secrets.token_urlsafe(32))
app.config["DATABASE"] = os.environ.get("DATABASE", "bank.sqlite3")
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = os.environ.get("FLASK_ENV") == "production"

MAX_TRANSFER_CENTS = 1_000_000_00


class TransferError(Exception):
    pass


def get_db():
    if "db" not in g:
        conn = sqlite3.connect(app.config["DATABASE"])
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        g.db = conn
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    db = get_db()

    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash BLOB NOT NULL
        );

        CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            balance_cents INTEGER NOT NULL CHECK (balance_cents >= 0),
            status TEXT NOT NULL DEFAULT 'active',
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS transfers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_account_id INTEGER NOT NULL,
            to_account_id INTEGER NOT NULL,
            amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
            memo TEXT,
            created_by INTEGER NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (from_account_id) REFERENCES accounts(id),
            FOREIGN KEY (to_account_id) REFERENCES accounts(id),
            FOREIGN KEY (created_by) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS transfer_nonces (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            nonce TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (user_id, nonce),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        """
    )

    existing = db.execute("SELECT COUNT(*) AS count FROM users").fetchone()["count"]
    if existing == 0:
        alice_hash = bcrypt.hashpw(
            b"correct horse battery staple",
            bcrypt.gensalt(rounds=12),
        )
        bob_hash = bcrypt.hashpw(b"password123", bcrypt.gensalt(rounds=12))

        cur = db.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            ("alice", alice_hash),
        )
        alice_id = cur.lastrowid

        cur = db.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            ("bob", bob_hash),
        )
        bob_id = cur.lastrowid

        db.execute(
            """
            INSERT INTO accounts (user_id, name, balance_cents)
            VALUES (?, ?, ?)
            """,
            (alice_id, "Alice Checking", 100_000),
        )
        db.execute(
            """
            INSERT INTO accounts (user_id, name, balance_cents)
            VALUES (?, ?, ?)
            """,
            (bob_id, "Bob Checking", 25_000),
        )

    db.commit()


@app.cli.command("init-db")
def init_db_command():
    init_db()
    print("Initialized database.")


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if session.get("user_id") is None:
            return redirect(url_for("login", next=request.full_path))
        return view(*args, **kwargs)

    return wrapped


def current_user_id():
    user_id = session.get("user_id")
    if user_id is None:
        abort(401)
    return int(user_id)


def csrf_token():
    token = session.get("csrf_token")
    if not token:
        token = secrets.token_urlsafe(32)
        session["csrf_token"] = token
    return token


@app.context_processor
def inject_csrf_token():
    return {"csrf_token": csrf_token}


def validate_csrf():
    submitted = request.form.get("csrf_token", "")
    expected = session.get("csrf_token", "")
    if not submitted or not expected or not secrets.compare_digest(submitted, expected):
        abort(400, "Invalid CSRF token")


def parse_amount_to_cents(raw_amount):
    if raw_amount is None:
        raise TransferError("Amount is required.")

    raw_amount = raw_amount.strip()
    if not raw_amount:
        raise TransferError("Amount is required.")

    try:
        amount = Decimal(raw_amount)
    except InvalidOperation:
        raise TransferError("Invalid amount.")

    if amount <= Decimal("0"):
        raise TransferError("Amount must be greater than zero.")

    if amount.as_tuple().exponent < -2:
        raise TransferError("Amount cannot have more than two decimal places.")

    cents = int(amount * 100)

    if cents <= 0:
        raise TransferError("Amount must be greater than zero.")

    if cents > MAX_TRANSFER_CENTS:
        raise TransferError("Transfer amount exceeds the allowed limit.")

    return cents


def parse_positive_int(raw_value, field_name):
    try:
        value = int(raw_value)
    except (TypeError, ValueError):
        raise TransferError(f"Invalid {field_name}.")
    if value <= 0:
        raise TransferError(f"Invalid {field_name}.")
    return value


@app.route("/")
def index():
    if session.get("user_id") is None:
        return redirect(url_for("login"))

    db = get_db()
    accounts = db.execute(
        """
        SELECT id, name, balance_cents, status
        FROM accounts
        WHERE user_id = ?
        ORDER BY id
        """,
        (session["user_id"],),
    ).fetchall()

    return render_template_string(
        """
        <!doctype html>
        <title>Accounts</title>
        <h1>Your accounts</h1>

        {% with messages = get_flashed_messages(with_categories=true) %}
          {% if messages %}
            <ul>
              {% for category, message in messages %}
                <li><strong>{{ category }}:</strong> {{ message }}</li>
              {% endfor %}
            </ul>
          {% endif %}
        {% endwith %}

        <ul>
          {% for account in accounts %}
            <li>
              Account #{{ account.id }} — {{ account.name }} —
              ${{ "%.2f"|format(account.balance_cents / 100) }} —
              {{ account.status }}
            </li>
          {% endfor %}
        </ul>

        <p><a href="{{ url_for('transfer') }}">Transfer funds</a></p>
        <form method="post" action="{{ url_for('logout') }}">
          <input type="hidden" name="csrf_token" value="{{ csrf_token() }}">
          <button type="submit">Log out</button>
        </form>
        """,
        accounts=accounts,
    )


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")

        db = get_db()
        user = db.execute(
            "SELECT id, password_hash FROM users WHERE username = ?",
            (username,),
        ).fetchone()

        if user and bcrypt.checkpw(password.encode("utf-8"), user["password_hash"]):
            session.clear()
            session["user_id"] = user["id"]
            session["csrf_token"] = secrets.token_urlsafe(32)
            return redirect(url_for("index"))

        flash("Invalid username or password.", "error")

    return render_template_string(
        """
        <!doctype html>
        <title>Login</title>
        <h1>Login</h1>

        {% with messages = get_flashed_messages(with_categories=true) %}
          {% if messages %}
            <ul>
              {% for category, message in messages %}
                <li><strong>{{ category }}:</strong> {{ message }}</li>
              {% endfor %}
            </ul>
          {% endif %}
        {% endwith %}

        <form method="post">
          <label>
            Username
            <input name="username" autocomplete="username" required>
          </label>
          <br>
          <label>
            Password
            <input name="password" type="password" autocomplete="current-password" required>
          </label>
          <br>
          <button type="submit">Log in</button>
        </form>
        <p>Demo user: alice / correct horse battery staple</p>
        """,
    )


@app.route("/logout", methods=["POST"])
@login_required
def logout():
    validate_csrf()
    session.clear()
    return redirect(url_for("login"))


@app.route("/transfer", methods=["GET", "POST"])
@login_required
def transfer():
    user_id = current_user_id()
    db = get_db()

    if request.method == "GET":
        session["transfer_nonce"] = secrets.token_urlsafe(32)

        accounts = db.execute(
            """
            SELECT id, name, balance_cents
            FROM accounts
            WHERE user_id = ? AND status = 'active'
            ORDER BY id
            """,
            (user_id,),
        ).fetchall()

        return render_template_string(
            """
            <!doctype html>
            <title>Transfer Funds</title>
            <h1>Transfer Funds</h1>

            {% with messages = get_flashed_messages(with_categories=true) %}
              {% if messages %}
                <ul>
                  {% for category, message in messages %}
                    <li><strong>{{ category }}:</strong> {{ message }}</li>
                  {% endfor %}
                </ul>
              {% endif %}
            {% endwith %}

            <form method="post" action="{{ url_for('transfer') }}">
              <input type="hidden" name="csrf_token" value="{{ csrf_token() }}">
              <input type="hidden" name="transfer_nonce" value="{{ session.transfer_nonce }}">

              <label>
                From account
                <select name="from_account_id" required>
                  {% for account in accounts %}
                    <option value="{{ account.id }}">
                      #{{ account.id }} — {{ account.name }} —
                      ${{ "%.2f"|format(account.balance_cents / 100) }}
                    </option>
                  {% endfor %}
                </select>
              </label>

              <br>

              <label>
                Destination account ID
                <input name="to_account_id" inputmode="numeric" required>
              </label>

              <br>

              <label>
                Amount
                <input name="amount" inputmode="decimal" placeholder="10.00" required>
              </label>

              <br>

              <label>
                Memo
                <input name="memo" maxlength="140">
              </label>

              <br>

              <button type="submit">Submit transfer</button>
            </form>

            <p><a href="{{ url_for('index') }}">Back to accounts</a></p>
            """,
            accounts=accounts,
        )

    validate_csrf()

    submitted_nonce = request.form.get("transfer_nonce", "")
    session_nonce = session.get("transfer_nonce", "")
    if (
        not submitted_nonce
        or not session_nonce
        or not secrets.compare_digest(submitted_nonce, session_nonce)
    ):
        abort(400, "Invalid transfer token")

    try:
        from_account_id = parse_positive_int(
            request.form.get("from_account_id"),
            "source account",
        )
        to_account_id = parse_positive_int(
            request.form.get("to_account_id"),
            "destination account",
        )
        amount_cents = parse_amount_to_cents(request.form.get("amount"))
        memo = request.form.get("memo", "").strip()[:140]

        if from_account_id == to_account_id:
            raise TransferError("Source and destination accounts must be different.")

        db.execute("BEGIN IMMEDIATE")

        try:
            db.execute(
                """
                INSERT INTO transfer_nonces (user_id, nonce)
                VALUES (?, ?)
                """,
                (user_id, submitted_nonce),
            )
        except sqlite3.IntegrityError:
            raise TransferError("This transfer request has already been submitted.")

        source = db.execute(
            """
            SELECT id
            FROM accounts
            WHERE id = ? AND user_id = ? AND status = 'active'
            """,
            (from_account_id, user_id),
        ).fetchone()

        if source is None:
            raise TransferError("Source account not found.")

        destination = db.execute(
            """
            SELECT id
            FROM accounts
            WHERE id = ? AND status = 'active'
            """,
            (to_account_id,),
        ).fetchone()

        if destination is None:
            raise TransferError("Destination account not found.")

        debit = db.execute(
            """
            UPDATE accounts
            SET balance_cents = balance_cents - ?
            WHERE id = ?
              AND user_id = ?
              AND status = 'active'
              AND balance_cents >= ?
            """,
            (amount_cents, from_account_id, user_id, amount_cents),
        )

        if debit.rowcount != 1:
            raise TransferError("Insufficient funds.")

        credit = db.execute(
            """
            UPDATE accounts
            SET balance_cents = balance_cents + ?
            WHERE id = ? AND status = 'active'
            """,
            (amount_cents, to_account_id),
        )

        if credit.rowcount != 1:
            raise TransferError("Unable to credit destination account.")

        cur = db.execute(
            """
            INSERT INTO transfers (
                from_account_id,
                to_account_id,
                amount_cents,
                memo,
                created_by
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            (from_account_id, to_account_id, amount_cents, memo, user_id),
        )

        db.commit()

        session["transfer_nonce"] = secrets.token_urlsafe(32)
        flash(f"Transfer #{cur.lastrowid} completed successfully.", "success")
        return redirect(url_for("index"))

    except TransferError as exc:
        if db.in_transaction:
            db.rollback()
        flash(str(exc), "error")
        return redirect(url_for("transfer"))

    except Exception:
        if db.in_transaction:
            db.rollback()
        raise


if __name__ == "__main__":
    with app.app_context():
        init_db()
    app.run(debug=False)