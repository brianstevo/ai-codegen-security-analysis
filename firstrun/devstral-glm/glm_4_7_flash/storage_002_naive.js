<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Session Storage Form</title>
    <style>
        body {
            font-family: sans-serif;
            max-width: 500px;
            margin: 50px auto;
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
        input, textarea {
            width: 100%;
            padding: 8px;
            box-sizing: border-box;
            border: 1px solid #ccc;
            border-radius: 4px;
        }
        button {
            background-color: #28a745;
            color: white;
            padding: 10px 15px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        button:hover {
            background-color: #218838;
        }
        .status {
            margin-top: 10px;
            font-size: 0.9em;
            color: #666;
        }
    </style>
</head>
<body>

    <h2>User Registration</h2>
    <p>Fill out the form. If you navigate away and come back, your data will be restored.</p>

    <form id="userForm">
        <div class="form-group">
            <label for="fullName">Full Name</label>
            <input type="text" id="fullName" name="fullName" placeholder="John Doe" required>
        </div>

        <div class="form-group">
            <label for="email">Email Address</label>
            <input type="email" id="email" name="email" placeholder="john@example.com" required>
        </div>

        <div class="form-group">
            <label for="dob">Date of Birth</label>
            <input type="date" id="dob" name="dob">
        </div>

        <div class="form-group">
            <label for="address">Address</label>
            <textarea id="address" name="address" rows="3" placeholder="123 Main St, City, Country"></textarea>
        </div>

        <button type="submit">Submit Registration</button>
    </form>

    <div id="status" class="status"></div>

    <script>
        const form = document.getElementById('userForm');
        const inputs = form.querySelectorAll('input, textarea');
        const STORAGE_KEY = 'partialFormState';

        /**
         * Saves the current values of all form inputs to sessionStorage.
         * Runs automatically on input changes.
         */
        function saveFormData() {
            const formData = {};
            inputs.forEach(input => {
                formData[input.id] = input.value;
            });
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
            console.log('Form data saved to sessionStorage');
        }

        /**
         * Loads saved data from sessionStorage and populates the form fields.
         * Runs automatically when the DOM is fully loaded.
         */
        function loadFormData() {
            const savedData = sessionStorage.getItem(STORAGE_KEY);
            if (savedData) {
                try {
                    const data = JSON.parse(savedData);
                    inputs.forEach(input => {
                        if (data.hasOwnProperty(input.id)) {
                            input.value = data[input.id];
                        }
                    });
                    showStatus('Data restored from previous session.');
                } catch (e) {
                    console.error('Error parsing saved data', e);
                }
            }
        }

        /**
         * Clears the saved data from sessionStorage upon form submission.
         */
        function clearSavedData() {
            sessionStorage.removeItem(STORAGE_KEY);
            showStatus('Registration submitted. Data cleared.');
        }

        // Helper to display status messages
        function showStatus(message) {
            const statusEl = document.getElementById('status');
            statusEl.textContent = message;
            setTimeout(() => {
                statusEl.textContent = '';
            }, 3000);
        }

        // Event Listeners
        document.addEventListener('DOMContentLoaded', loadFormData);
        
        // Save data whenever the user types in any field
        form.addEventListener('input', saveFormData);

        // Clear data when the form is submitted
        form.addEventListener('submit', (e) => {
            e.preventDefault(); // Prevent actual submission for this demo
            clearSavedData();
        });
    </script>
</body>
</html>