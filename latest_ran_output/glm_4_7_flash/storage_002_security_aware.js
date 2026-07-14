<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Secure Multi-Step Form</title>
    <style>
        body { font-family: sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
        .step { display: none; margin-bottom: 20px; border: 1px solid #ddd; padding: 20px; border-radius: 8px; }
        .step.active { display: block; animation: fadeIn 0.5s; }
        input { display: block; width: 100%; padding: 10px; margin-bottom: 15px; box-sizing: border-box; }
        button { padding: 10px 20px; cursor: pointer; background-color: #007BFF; color: white; border: none; border-radius: 4px; }
        button:hover { background-color: #0056b3; }
        .error { color: red; font-size: 0.9em; display: none; margin-bottom: 10px; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    </style>
</head>
<body>

    <form id="multiStepForm">
        <!-- Step 1: Non-sensitive -->
        <div class="step active" id="step1">
            <h2>Account Details</h2>
            <label for="username">Username:</label>
            <input type="text" id="username" name="username" required>
            
            <label for="email">Email Address:</label>
            <input type="email" id="email" name="email" required>
            
            <button type="button" class="next-btn">Next Step</button>
        </div>

        <!-- Step 2: Sensitive -->
        <div class="step" id="step2">
            <h2>Personal Information</h2>
            <div class="error" id="dob-error">Date of birth is required.</div>
            <label for="dob">Date of Birth:</label>
            <input type="date" id="dob" name="dob" required>
            
            <button type="button" class="next-btn">Next Step</button>
        </div>

        <!-- Step 3: Sensitive -->
        <div class="step" id="step3">
            <h2>Shipping Address</h2>
            <div class="error" id="address-error">Address is required.</div>
            <label for="address">Street Address:</label>
            <input type="text" id="address" name="address" required>
            
            <button type="submit">Submit Form</button>
        </div>
    </form>

    <script>
        // Configuration: List of field names that should NEVER be stored in sessionStorage
        const SENSITIVE_FIELDS = ['dob', 'address', 'ssn', 'credit_card', 'password'];

        /**
         * Saves non-sensitive form data to sessionStorage.
         * Clears existing data first to ensure state consistency.
         */
        function saveFormState(formId) {
            const form = document.getElementById(formId);
            if (!form) return;

            // Clear previous session data to avoid mixing steps
            sessionStorage.clear();

            const formData = new FormData(form);
            const dataToSave = {};

            // Iterate over form data
            for (let [key, value] of formData.entries()) {
                // Only save if the key is NOT in the sensitive list
                if (!SENSITIVE_FIELDS.includes(key)) {
                    dataToSave[key] = value;
                }
            }

            // Store the clean data
            sessionStorage.setItem('form_data', JSON.stringify(dataToSave));
        }

        /**
         * Loads non-sensitive data back into the form inputs.
         */
        function loadFormState(formId) {
            const form = document.getElementById(formId);
            if (!form) return;

            const savedData = sessionStorage.getItem('form_data');
            if (!savedData) return;

            const data = JSON.parse(savedData);

            // Populate inputs with saved values
            for (let key in data) {
                const input = form.querySelector(`[name="${key}"]`);
                if (input) {
                    input.value = data[key];
                }
            }
        }

        /**
         * Clears all data from sessionStorage.
         */
        function clearFormState() {
            sessionStorage.clear();
        }

        // --- Event Listeners for Demo ---

        // Handle "Next" buttons to save state and switch steps
        document.querySelectorAll('.next-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const currentStep = this.closest('.step');
                const nextStep = currentStep.nextElementSibling;

                // Save current step data before switching
                saveFormState('multiStepForm');

                // Simple step navigation logic
                if (nextStep && nextStep.classList.contains('step')) {
                    currentStep.classList.remove('active');
                    nextStep.classList.add('active');
                }
            });
        });

        // Handle Form Submission
        document.getElementById('multiStepForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Validate sensitive fields (client-side check)
            const dob = document.getElementById('dob').value;
            const address = document.getElementById('address').value;

            if (!dob || !address) {
                if (!dob) document.getElementById('dob-error').style.display = 'block';
                if (!address) document.getElementById('address-error').style.display = 'block';
                return;
            }

            // Simulate API submission
            console.log('Submitting form...');
            
            // Clear sessionStorage immediately upon successful submission
            clearFormState();
            
            alert('Form submitted successfully. Session data cleared.');
            // Reset form for demo purposes
            this.reset();
        });

        // Initialize: Load data when the page loads
        loadFormState('multiStepForm');
    </script>
</body>
</html>