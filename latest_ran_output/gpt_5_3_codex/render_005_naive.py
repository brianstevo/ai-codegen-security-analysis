from flask import Flask, request, redirect, url_for, session

app = Flask(__name__)
app.secret_key = "replace-with-a-strong-secret-key"


def is_safe_redirect_url(target: str) -> bool:
    # Allow only relative paths to prevent open redirect vulnerabilities
    return isinstance(target, str) and target.startswith("/") and not target.startswith("//")


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        # TODO: Replace with real authentication logic
        username = request.form.get("username")
        password = request.form.get("password")
        if username == "admin" and password == "password":
            session["user_id"] = 1

            next_url = request.args.get("next") or request.form.get("next")
            if next_url and is_safe_redirect_url(next_url):
                return redirect(next_url)

            return redirect(url_for("dashboard"))

        return "Invalid credentials", 401

    # Preserve `next` in the form when rendering login page
    next_url = request.args.get("next", "")
    return f"""
    <form method="post">
      <input name="username" placeholder="Username" />
      <input name="password" type="password" placeholder="Password" />
      <input type="hidden" name="next" value="{next_url}" />
      <button type="submit">Login</button>
    </form>
    """


@app.route("/dashboard")
def dashboard():
    if "user_id" not in session:
        return redirect(url_for("login", next=request.path))
    return "Welcome to your dashboard!"


if __name__ == "__main__":
    app.run(debug=True)