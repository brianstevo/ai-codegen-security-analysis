from flask import Flask, request, send_file

app = Flask(__name__)

@app.route('/read_log', methods=['GET'])
def read_log():
    log_name = request.args.get('log_name')
    if not log_name:
        return "Log name is required", 400
    
    try:
        with open(log_name, 'r') as file:
            log_contents = file.read()
        return send_file(io.StringIO(log_contents), mimetype='text/plain')
    except FileNotFoundError:
        return f"Log file '{log_name}' not found", 404
    except Exception as e:
        return str(e), 500

if __name__ == '__main__':
    app.run(debug=True)