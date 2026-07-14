<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SessionStorage Form Persistence</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 500px;
            margin: 50px auto;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
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
            background-color: #007BFF;
            color: white;
            padding: 10px 15px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
        }
        button:hover {
            background-color: #0056b3;
        }
        .status {
            margin-top: 10px;
            font-size: 0.9em;
            color: #28a745;
        }
    </style>
</head>
<body>

    <h2>User Profile Form</h2>
    <p>Try navigating away and coming back; your data will be restored.</p>

    <form id="userForm">
        <div class="form-group">
            <label for="fullName">Full Name</label>
            <input type="text" id="fullName" name="fullName" placeholder="Enter your name" required>
        </div>

        <div class="form-group">
            <label for="dob">Date of Birth</label>
            <input type="date" id="dob" name="dob" required>
        </div>

        <div class="form-group">
            <label for="address">Address</label>
            <textarea id="address" name="address" rows="4" placeholder="Enter your address" required></textarea>
        </div>

        <div class="form-group">
            <label for="email">Email</label>
            <input type="email" id="email" name="email" placeholder="Enter your email" required>
        </div>

        <button type="submit">Submit Profile</button>
    </form>

    <div id="status" class="status"></div>

    <script>
        /**
         * Saves the current state of a form to sessionStorage.
         * @param {string} formId - The ID of the form element.
         */
        function saveFormToSessionStorage(formId) {
            const form = document.getElementById(formId);
            if (!form) return;

            const formData = new FormData(form);
            const data = {};
            
            // Iterate over all form fields and store their values
            formData.forEach((value, key) => {
                data[key] = value;
            });

            // Store the object as a JSON string
            sessionStorage.setItem('userFormData', JSON.stringify(data));
        }

        /**
         * Loads saved data from sessionStorage into the form fields.
         * @param {string} formId - The ID of the form element.
         */
        function loadFormFromSessionStorage(formId) {
            const form = document.getElementById(formId);
            if (!form) return;

            const savedData = sessionStorage.getItem('userFormData');
            if (savedData) {
                try {
                    const data = JSON.parse(savedData);
                    
                    // Populate fields based on their 'name' attribute
                    for (const key in data) {
                        const input = form.querySelector(`[name="${key}"]`);
                        if (input) {
                            input.value = data[key];
                        }
                    }
                } catch (e) {
                    console.error("Error parsing saved form data", e);
                }
            }
        }

        // --- Initialization and Event Listeners ---

        document.addEventListener('DOMContentLoaded', () => {
            // Load data when the page first loads
            loadFormFromSessionStorage('userForm');
        });

        // Save data whenever the user types in any field
        const form = document.getElementById('userForm');
        form.addEventListener('input', () => {
            saveFormToSessionStorage('userForm');
        });

        // Handle form submission (optional: clear storage or redirect)
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const statusDiv = document.getElementById('status');
            statusDiv.textContent = "Form submitted successfully!";
            statusDiv.style.color = "#28a745";
            
            // Optional: Clear sessionStorage on successful submit
            // sessionStorage.removeItem('userFormData');
        });
    </script>
</body>
</html>