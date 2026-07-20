```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Form with Session Storage</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            color: #555;
            font-weight: bold;
        }
        input, textarea {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-sizing: border-box;
            font-size: 14px;
        }
        textarea {
            resize: vertical;
            min-height: 100px;
        }
        .button-group {
            display: flex;
            gap: 10px;
            margin-top: 30px;
        }
        button {
            flex: 1;
            padding: 12px;
            border: none;
            border-radius: 4px;
            font-size: 16px;
            cursor: pointer;
            transition: background-color 0.3s;
        }
        .btn-save {
            background-color: #4CAF50;
            color: white;
        }
        .btn-save:hover {
            background-color: #45a049;
        }
        .btn-clear {
            background-color: #f44336;
            color: white;
        }
        .btn-clear:hover {
            background-color: #da190b;
        }
        .btn-load {
            background-color: #2196F3;
            color: white;
        }
        .btn-load:hover {
            background-color: #0b7dda;
        }
        .status-message {
            padding: 12px;
            margin-top: 20px;
            border-radius: 4px;
            text-align: center;
            font-weight: bold;
        }
        .success {
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .error {
            background-color: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .info {
            background-color: #d1ecf1;
            color: #0c5460;
            border: 1px solid #bee5eb;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Registration Form</h1>
        <form id="registrationForm">
            <div class="form-group">
                <label for="firstName">First Name:</label>
                <input type="text" id="firstName" name="firstName" placeholder="Enter your first name">
            </div>

            <div class="form-group">
                <label for="lastName">Last Name:</label>
                <input type="text" id="lastName" name="lastName" placeholder="Enter your last name">
            </div>

            <div class="form-group">
                <label for="email">Email:</label>
                <input type="email" id="email" name="email" placeholder="Enter your email">
            </div>

            <div class="form-group">
                <label for="dateOfBirth">Date of Birth:</label>
                <input type="date" id="dateOfBirth" name="dateOfBirth">
            </div>

            <div class="form-group">
                <label for="street">Street Address:</label>
                <input type="text" id="street" name="street" placeholder="Enter street address">
            </div>

            <div class="form-group">
                <label for="city">City:</label>
                <input type="text" id="city" name="city" placeholder="Enter city">
            </div>

            <div class="form-group">
                <label for="state">State/Province:</label>
                <input type="text" id="state" name="state" placeholder="Enter state or province">
            </div>

            <div class="form-group">
                <label for="zipCode">ZIP/Postal Code:</label>
                <input type="text" id="zipCode" name="zipCode" placeholder="Enter ZIP or postal code">
            </div>

            <div class="form-group">
                <label for="country">Country:</label>
                <input type="text" id="country" name="country" placeholder="Enter country">
            </div>

            <div class="form-group">
                <label for="notes">Additional Notes:</label>
                <textarea id="notes" name="notes" placeholder="Enter any additional information"></textarea>
            </div>

            <div class="button-group">
                <button type="button" class="btn-load" onclick="loadFormData()">Load Saved Data</button>
                <button type="button" class="btn-save" onclick="saveFormData()">Save Progress</button>
                <button type="button" class="btn-clear" onclick="clearSavedData()">Clear Saved</button>
            </div>
        </form>

        <div id="statusMessage"></div>
    </div>

    <script>
        const STORAGE_KEY = 'formData';
        const STORAGE_TIMESTAMP_KEY = 'formDataTimestamp';

        function saveFormData() {
            const form = document.getElementById('registrationForm');
            const formData = new FormData(form);
            const dataObject = {
                timestamp: new Date().toISOString(),
                fields: {}
            };

            for (let [key, value] of formData.entries()) {
                dataObject.fields[key] = value;
            }

            try {
                sessionStorage.setItem(STORAGE_KEY, JSON.stringify(dataObject.fields));
                sessionStorage.setItem(STORAGE_TIMESTAMP_KEY, dataObject.timestamp);
                showMessage(`Form data saved successfully at ${new Date().toLocaleTimeString()}`, 'success');
            } catch (error) {
                showMessage('Error saving form data: ' + error.message, 'error');
            }
        }

        function loadFormData() {
            try {
                const savedData = sessionStorage.getItem(STORAGE_KEY);
                const timestamp = sessionStorage.getItem(STORAGE_TIMESTAMP_KEY);

                if (!savedData) {
                    showMessage('No saved form data found', 'info');
                    return;
                }

                const dataObject = JSON.parse(savedData);
                const form = document.getElementById('registrationForm');

                for (let [key, value] of Object.entries(dataObject)) {
                    const element = form.elements[key];
                    if (element) {
                        element.value = value;
                    }
                }

                const savedTime = new Date(timestamp).toLocaleString();
                showMessage(`Form data loaded from ${savedTime}`, 'success');
            } catch (error) {
                showMessage('Error loading form data: ' + error.message, 'error');
            }
        }

        function clearSavedData() {
            try {
                sessionStorage.removeItem(STORAGE_KEY);
                sessionStorage.removeItem(STORAGE_TIMESTAMP_KEY);
                showMessage('Saved data cleared successfully', 'success');
            } catch (error) {
                showMessage('Error clearing saved data: ' + error.message, 'error');
            }
        }

        function showMessage(message, type) {
            const statusDiv = document.getElementById('statusMessage');