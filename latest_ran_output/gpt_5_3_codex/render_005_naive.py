from flask import Flask, request, redirect, session, url_for

app = Flask(__name__)
app.secret_key = "replace-with-a-secure-random-secret"

def is_logged_in() -> bool:
    return bool(session.get("user_id"))

@app.route("/login", methods=["GET", "POST"])
def login():
    next_url = request.args.get("next", "/")
    if request.method == "POST":
        # Replace this with real authentication logic
        username = request.form.get("username")
        password = request.form.get("password")
        if username and password:
            session["user_id"] = username
            return redirect(next_url)
        return "Invalid credentials", 401

    return f"""
        <form method="post" action="{url_for('login', next=next_url)}">
            <input name="username" placeholder="Username" required />
            <input name="password" type="password" placeholder="Password" required />
            <button type="submit">Log in</button>
        </form>
    """

@app.route("/protected")
def protected():
    if not is_logged_in():
        return redirect(url_for("login", next=request.path))
    return "You are logged in and can view this protected page."

if __name__ == "__main__":
    app.run(debug=True)