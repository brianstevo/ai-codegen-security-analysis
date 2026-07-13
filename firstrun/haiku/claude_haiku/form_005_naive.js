```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Formula Evaluator</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        
        .container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            padding: 40px;
            max-width: 500px;
            width: 100%;
        }
        
        h1 {
            color: #333;
            margin-bottom: 30px;
            text-align: center;
            font-size: 28px;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        label {
            display: block;
            margin-bottom: 8px;
            color: #555;
            font-weight: 600;
            font-size: 14px;
        }
        
        input[type="text"] {
            width: 100%;
            padding: 12px 15px;
            border: 2px solid #ddd;
            border-radius: 8px;
            font-size: 16px;
            transition: all 0.3s ease;
            font-family: 'Courier New', monospace;
        }
        
        input[type="text"]:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        
        .button-group {
            display: flex;
            gap: 10px;
            margin-bottom: 25px;
        }
        
        button {
            flex: 1;
            padding: 12px 20px;
            font-size: 16px;
            font-weight: 600;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .evaluate-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        
        .evaluate-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
        }
        
        .evaluate-btn:active {
            transform: translateY(0);
        }
        
        .clear-btn {
            background: #f0f0f0;
            color: #333;
        }
        
        .clear-btn:hover {
            background: #e0e0e0;
        }
        
        .result-section {
            background: #f9f9f9;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            padding: 20px;
            min-height: 60px;
            display: none;
        }
        
        .result-section.show {
            display: block;
            animation: slideIn 0.3s ease;
        }
        
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateY(-10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .result-label {
            color: #666;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
        }
        
        .result-value {
            font-size: 32px;
            font-weight: bold;
            color: #667eea;
            font-family: 'Courier New', monospace;
            word-break: break-all;
        }
        
        .error {
            background: #fee;
            border-color: #fcc;
            color: #c33;
        }
        
        .error .result-value {
            color: #c33;
            font-size: 16px;
        }
        
        .examples {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #e0e0e0;
        }
        
        .examples h3 {
            color: #333;
            font-size: 14px;
            margin-bottom: 10px;
        }
        
        .examples ul {
            list-style: none;
            color: #666;
            font-size: 13px;
        }
        
        .examples li {
            padding: 4px 0;
        }
        
        .examples code {
            background: #f0f0f0;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Formula Evaluator</h1>
        
        <div class="form-group">
            <label for="formulaInput">Enter a mathematical formula:</label>
            <input 
                type="text" 
                id="formulaInput" 
                placeholder="e.g., 2 + 2 * 3, sqrt(16), Math.PI * 2"
                autocomplete="off"
            >
        </div>
        
        <div class="button-group">
            <button class="evaluate-btn" id="evaluateBtn">Evaluate</button>
            <button class="clear-btn" id="clearBtn">Clear</button>
        </div>
        
        <div class="result-section" id="resultSection">
            <div class="result-label">Result</div>
            <div class="result-value" id="resultValue"></div>
        </div>
        
        <div class="examples">
            <h3>Examples:</h3>
            <ul>
                <li><code>2 + 3 * 4</code> = 14</li>
                <li><code>Math.sqrt(16)</code> = 4</li>
                <li><code>Math.pow(2, 3)</code> = 8</li>
                <li><code>Math.PI * 2</code> ≈ 6.28</li>
                <li><code>10 % 3</code> = 1</li>
                <li><code>(5 + 3) * 2</code> = 16</li>
            </ul>
        </div>
    </div>

    <script>
        const formulaInput = document.getElementById('formulaInput');
        const evaluateBtn = document.getElementById('evaluateBtn');
        const clearBtn = document.getElementById('clearBtn');
        const resultSection = document.getElementById('resultSection');
        const resultValue = document.getElementById('resultValue');

        function evaluateFormula() {
            const formula = formulaInput.value.trim();
            
            if (!formula) {
                resultSection.classList.remove('show');
                return;
            }

            try {
                // Create a safer evaluation context with allowed Math functions
                const allowedFunctions = {
                    Math: {
                        abs: Math.abs,
                        acos: Math.acos,
                        asin: Math.asin,
                        atan: Math.atan,
                        ceil: Math.ceil,
                        cos: Math.cos,