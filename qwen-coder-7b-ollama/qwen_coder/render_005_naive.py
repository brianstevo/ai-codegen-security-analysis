from flask import Flask, request, redirect, url_for

app = Flask(__name__)

@app.route('/login', methods=['GET'])
def login():
    next_url = request.args.get('next')
    if not next_url:
        return "No 'next' URL provided", 400
    # Simulate successful login
    return redirect(next_url)

if __name__ == '__main__':
    app.run(debug=True)