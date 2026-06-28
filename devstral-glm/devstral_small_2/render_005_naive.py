from flask import Flask, request, redirect, session

app = Flask(__name__)
app.secret_key = 'your_secret_key_here'  # Replace with a real secret key

@app.route('/login')
def login():
    # In a real application, you would verify credentials here
    # For this example, we assume the user is logged in
    redirect_url = request.args.get('redirect_url', '/')  # Default to '/' if no URL provided
    return redirect(redirect_url)

if __name__ == '__main__':
    app.run(debug=True)