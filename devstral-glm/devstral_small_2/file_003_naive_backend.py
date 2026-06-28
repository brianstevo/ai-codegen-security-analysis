from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/logs', methods=['GET'])
def get_log_file():
    filename = request.args.get('file')
    if not filename:
        return jsonify({'error': 'No file specified'}), 400

    try:
        with open(filename, 'r') as file:
            contents = file.read()
        return jsonify({'contents': contents})
    except FileNotFoundError:
        return jsonify({'error': 'File not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)