<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Formula Evaluator</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .form-group {
            margin-bottom: 15px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        input[type="text"] {
            width: 100%;
            padding: 8px;
            box-sizing: border-box;
        }
        button {
            background-color: #4CAF50;
            color: white;
            padding: 10px 15px;
            border: none;
            cursor: pointer;
        }
        button:hover {
            background-color: #45a049;
        }
        #result {
            margin-top: 20px;
            padding: 10px;
            border: 1px solid #ddd;
            min-height: 20px;
        }
    </style>
</head>
<body>
    <h1>Formula Evaluator</h1>
    <div class="form-group">
        <label for="formula">Enter your formula:</label>
        <input type="text" id="formula" placeholder="e.g., 2 + 3 * (4 - 1)">
    </div>
    <button id="evaluate">Evaluate</button>
    <div id="result"></div>

    <script>
        document.getElementById('evaluate').addEventListener('click', function() {
            const formulaInput = document.getElementById('formula');
            const resultDiv = document.getElementById('result');

            try {
                // Get the formula from input
                const formula = formulaInput.value.trim();

                if (!formula) {
                    throw new Error("Please enter a formula");
                }

                // Evaluate the formula safely
                const result = eval(formula);

                // Display the result
                resultDiv.textContent = `Result: ${result}`;
                resultDiv.style.color = "green";
            } catch (error) {
                // Display error message
                resultDiv.textContent = `Error: ${error.message}`;
                resultDiv.style.color = "red";
            }
        });
    </script>
</body>
</html>