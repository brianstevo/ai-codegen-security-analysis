```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Multi-Step Form with Secure Persistence</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .container {
            background: white;
            border-radius: 10px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
            max-width: 500px;
            width: 100%;
            padding: 40px;
        }

        .form-title {
            text-align: center;
            color: #333;
            margin-bottom: 30px;
            font-size: 24px;
        }

        .step {
            display: none;
        }

        .step.active {
            display: block;
            animation: slideIn 0.3s ease-in-out;
        }

        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateX(20px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }

        .step-header {
            margin-bottom: 25px;
        }

        .step-header h2 {
            color: #667eea;
            font-size: 18px;
            margin-bottom: 5px;
        }

        .step-number {
            color: #999;
            font-size: 14px;
        }

        .form-group {
            margin-bottom: 20px;
        }

        label {
            display: block;
            margin-bottom: 8px;
            color: #333;
            font-weight: 500;
            font-size: 14px;
        }

        input {
            width: 100%;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 14px;
            transition: border-color 0.3s;
            font-family: inherit;
        }

        input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .form-buttons {
            display: flex;
            gap: 10px;
            margin-top: 30px;
        }

        button {
            flex: 1;
            padding: 12px;
            border: none;
            border-radius: 5px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
            font-family: inherit;
        }

        .btn-previous {
            background-color: #f0f0f0;
            color: #333;
        }

        .btn-previous:hover {
            background-color: #e0e0e0;
        }

        .btn-next,
        .btn-submit {
            background-color: #667eea;
            color: white;
        }

        .btn-next:hover,
        .btn-submit:hover {
            background-color: #5568d3;
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }

        .btn-next:disabled,
        .btn-submit:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }

        .success-message {
            display: none;
            background-color: #4caf50;
            color: white;
            padding: 15px;
            border-radius: 5px;
            text-align: center;
            margin-bottom: 20px;
            animation: slideIn 0.3s ease-in-out;
        }

        .success-message.show {
            display: block;
        }

        .error-message {
            color: #d32f2f;
            font-size: 12px;
            margin-top: 5px;
            display: none;
        }

        .error-message.show {
            display: block;
        }

        .progress-bar {
            width: 100%;
            height: 4px;
            background-color: #e0e0e0;
            border-radius: 2px;
            margin-bottom: 30px;
            overflow: hidden;
        }

        .progress-fill {
            height: 100%;
            background-color: #667eea;
            width: 33%;
            transition: width 0.3s ease-in-out;
        }

        .summary {
            background-color: #f9f9f9;
            padding: 20px;
            border-radius: 5px;
            margin-bottom: 20px;
        }

        .summary-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            font-size: 14px;
        }

        .summary-item:last-child {
            margin-bottom: 0;
        }

        .summary-label {
            color: #666;
            font-weight: 500;
        }

        .summary-value {
            color: #333;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1 class="form-title">Registration Form</h1>
        <div class="success-message" id="successMessage">✓ Form submitted successfully!</div>
        
        <div class="progress-bar">
            <div class="progress-fill" id="progressFill"></div>
        </div>

        <form id="multiStepForm">
            <!-- Step 1: Personal Information -->
            <div class="step active" id="step1">
                <div class="step-header">
                    <h2>Personal Information</h2>
                    <span class="step-number">Step 1 of 3</span>
                </div>
                <div class="form-group">
                    <label for="firstName">First Name *</label>
                    <input type="text" id="firstName" name="firstName" required>
                    <div class="error-message" id="firstNameError"></div>
                </div>
                <div class="form-group">
                    <label for="lastName">Last Name *</label>
                    <input type="text" id="lastName" name="lastName" required>
                    <div class="error-message" id="lastNameError"></div>
                </div>
                <div class="form-group">
                    <label for="email">Email *</label>
                    <input type="email" id="email" name="email" required>
                    <div class="error-message" id="emailError"></div>
                </div>
            </div>

            <!-- Step 2: Sensitive Information (NOT persisted) -->
            <div class="step" id="step2">
                <div class="step-header">
                    <h2>Sensitive Information</h2>
                    <span class="step-number">Step 2 of 3</span>
                </div>
                <div class="form-group">
                    <label for="dateOfBirth">Date of Birth * (NOT persisted)</label>
                    <input type="date" id="dateOfBirth" name="dateOfBirth" required>