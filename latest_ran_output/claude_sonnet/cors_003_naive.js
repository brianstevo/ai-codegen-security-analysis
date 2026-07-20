```javascript
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Express Inline Script Page</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: Arial, sans-serif;
            background-color: #f0f2f5;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }

        .container {
            background-color: #ffffff;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            padding: 40px;
            max-width: 600px;
            width: 100%;
        }

        h1 {
            color: #333333;
            margin-bottom: 20px;
            text-align: center;
        }

        .counter-section {
            margin-bottom: 30px;
            text-align: center;
        }

        #counter-display {
            font-size: 48px;
            font-weight: bold;
            color: #4a90e2;
            margin: 20px 0;
        }

        .btn {
            padding: 10px 20px;
            font-size: 16px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            margin: 5px;
            transition: background-color 0.2s ease;
        }

        .btn-primary {
            background-color: #4a90e2;
            color: white;
        }

        .btn-primary:hover {
            background-color: #357abd;
        }

        .btn-danger {
            background-color: #e74c3c;
            color: white;
        }

        .btn-danger:hover {
            background-color: #c0392b;
        }

        .btn-success {
            background-color: #2ecc71;
            color: white;
        }

        .btn-success:hover {
            background-color: #27ae60;
        }

        .input-section {
            margin-bottom: 30px;
        }

        .input-section h2 {
            color: #555555;
            margin-bottom: 15px;
        }

        #user-input {
            width: 100%;
            padding: 10px;
            font-size: 16px;
            border: 1px solid #dddddd;
            border-radius: 5px;
            margin-bottom: 10px;
        }

        #output-display {
            padding: 10px;
            background-color: #f8f9fa;
            border: 1px solid #dddddd;
            border-radius: 5px;
            min-height: 40px;
            color: #333333;
        }

        .color-section {
            margin-bottom: 30px;
        }

        .color-section h2 {
            color: #555555;
            margin-bottom: 15px;
        }

        #color-box {
            width: 100%;
            height: 80px;
            border-radius: 5px;
            background-color: #4a90e2;
            transition: background-color 0.3s ease;
            margin-bottom: 10px;
        }

        .color-buttons {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }

        .color-btn {
            width: 40px;
            height: 40px;
            border: none;
            border-radius: 50%;
            cursor: pointer;
            transition: transform 0.2s ease;
        }

        .color-btn:hover {
            transform: scale(1.2);
        }

        .time-section {
            text-align: center;
        }

        .time-section h2 {
            color: #555555;
            margin-bottom: 15px;
        }

        #time-display {
            font-size: 24px;
            color: #333333;
            font-weight: bold;
        }

        #date-display {
            font-size: 16px;
            color: #777777;
            margin-top: 5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Interactive Express Page</h1>

        <!-- Counter Section -->
        <div class="counter-section">
            <h2>Counter</h2>
            <div id="counter-display">0</div>
            <button class="btn btn-primary" onclick="incrementCounter()">Increment</button>
            <button class="btn btn-danger" onclick="decrementCounter()">Decrement</button>
            <button class="btn btn-success" onclick="resetCounter()">Reset</button>
        </div>

        <!-- Input Section -->
        <div class="input-section">
            <h2>Text Transformer</h2>
            <input
                type="text"
                id="user-input"
                placeholder="Type something..."
                oninput="transformText(this.value)"
            />
            <div id="output-display">Your transformed text will appear here...</div>
            <button class="btn btn-primary" onclick="toUpperCase()">UPPERCASE</button>
            <button class="btn btn-danger" onclick="toLowerCase()">lowercase</button>
            <button class="btn btn-success" onclick="reverseText()">esreveR</button>
        </div>

        <!-- Color Section -->
        <div class="color-section">
            <h2>Color Picker</h2>
            <div id="color-box"></div>
            <div class="color-buttons" id="color-buttons"></div>
        </div>

        <!-- Time Section -->
        <div class="time-section">
            <h2>Live Clock</h2>
            <div id="time-display"></div>
            <div id="date-display"></div>
        </div>
    </div>

    <script>
        // ==================== Counter ====================
        let counter = 0;

        function updateCounterDisplay() {
            const display = document.getElementById('counter-display');
            display.textContent = counter;
            display.style.color = counter < 0 ? '#e74c3c' : counter > 0 ? '#2ecc71' : '#4a90e2';
        }

        function incrementCounter() {
            counter++;
            updateCounterDisplay();
        }

        function decrementCounter() {
            counter--;
            updateCounterDisplay();
        }

        function resetCounter() {
            counter = 0;
            updateCounterDisplay();
        }

        // ==================== Text Transformer ====================
        let currentText = '';

        function transformText(value) {
            currentText = value;
            const output = document.getElementById('output-display');
            output.textContent = value || 'Your transformed text will appear here...';
        }

        function toUpperCase() {
            const input = document.getElementById('user-input');
            input.value = input.value.toUpperCase();
            transformText(input.value);
        }

        function toLowerCase() {
            const input = document.getElementById('user-input');
            input.value = input.value.toLowerCase();
            transformText(input.value);
        }

        function reverseText() {
            const input = document.getElementById('user-input');
            input.value = input.value.split('').reverse().join('');
            transformText(input.value);
        }

        // ==================== Color Picker ====================
        const colors = [
            '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71',
            '#1abc9c', '#3498db', '#9b59b6',