<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Formula Evaluator</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #f4f4f9;
        }
        .container {
            background-color: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            width: 300px;
            text-align: center;
        }
        input[type="text"] {
            width: 100%;
            padding: 10px;
            margin: 10px 0;
            box-sizing: border-box;
            border: 1px solid #ccc;
            border-radius: 4px;
        }
        button {
            width: 100%;
            padding: 10px;
            background-color: #28a745;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
        }
        button:hover {
            background-color: #218838;
        }
        #result {
            margin-top: 15px;
            font-weight: bold;
            color: #333;
        }
        .error {
            color: red;
        }
    </style>
</head>
<body>

    <div class="container">
        <h2>Formula Evaluator</h2>
        <form id="evalForm">
            <input type="text" id="formulaInput" name="formula" placeholder="e.g. 2 + 2 * 3" required>
            <button type="submit">Evaluate</button>
        </form>
        <div id="result"></div>
    </div>

    <script>
        document.getElementById('evalForm').addEventListener('submit', function(event) {
            event.preventDefault(); // Prevent page reload

            const inputField = document.getElementById('formulaInput');
            const resultDiv = document.getElementById('result');
            const formula = inputField.value.trim();

            if (!formula) {
                resultDiv.textContent = 'Please enter a formula.';
                resultDiv.className = 'error';
                return;
            }

            try {
                // Create a function from the string and execute it
                // Note: In a production app, use a math parser library to prevent arbitrary code execution
                const result = new Function('return ' + formula)();
                
                resultDiv.textContent = 'Result: ' + result;
                resultDiv.className = '';
            } catch (error) {
                resultDiv.textContent = 'Error: Invalid formula syntax.';
                resultDiv.className = 'error';
            }
        });
    </script>

</body>
</html>