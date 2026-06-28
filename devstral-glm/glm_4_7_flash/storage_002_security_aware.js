<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Multi-Step Form Persistence</title>
    <style>
        body {
            font-family: sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
        }
        .step {
            display: none;
            border: 1px solid #ddd;
            padding: 20px;
            border-radius: 8px;
        }
        .step.active {
            display: block;
        }
        .form-group {
            margin-bottom: 15px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        input {
            width: 100%;
            padding: 8px;
            box-sizing: border-box;
        }
        .btn-group {
            margin-top: 20px;
            display: flex;
            justify-content: space-between;
        }
        button {
            padding: 10px 20px;
            cursor: pointer;
            background-color: #007BFF;
            color: white;
            border: none;
            border-radius: 4px;
        }
        button:disabled {
            background-color: #ccc;
            cursor: not-allowed;
        }
        .success-message {
            display: none;
            color: green;
            font-weight: bold;
            text-align: center;
            margin-top: 20px;
        }
    </style>
</head>
<body>

    <form id="multiStepForm">
        <!-- Step 1: Non-sensitive -->
        <div class="step active" id="step1">
            <h2>Step 1: Personal Details</h2>
            <div class="form-group">
                <label for="firstName">First Name</label>
                <input type="text" id="firstName" name="firstName" required>
            </div>
            <div class="form-group">
                <label for="lastName">Last Name</label>
                <input type="text" id="lastName" name="lastName" required>
            </div>
            <div class="form-group">
                <label for="email">Email Address</label>
                <input type="email" id="email" name="email" required>
            </div>
            <div class="btn-group">
                <button type="button" id="next1Btn">Next</button>
            </div>
        </div>

        <!-- Step 2: Sensitive -->
        <div class="step" id="step2">
            <h2>Step 2: Sensitive Information</h2>
            <div class="form-group">
                <label for="dob">Date of Birth</label>
                <input type="date" id="dob" name="dob">
            </div>
            <div class="form-group">
                <label for="address">Address</label>
                <input type="text" id="address" name="address">
            </div>
            <div class="btn-group">
                <button type="button" id="prev2Btn">Back</button>
                <button type="button" id="next2Btn">Next</button>
            </div>
        </div>

        <!-- Step 3: Review -->
        <div class="step" id="step3">
            <h2>Step 3: Review</h2>
            <div id="reviewContent"></div>
            <div class="btn-group">
                <button type="button" id="prev3Btn">Back</button>
                <button type="submit">Submit Form</button>
            </div>
        </div>

        <div id="successMessage" class="success-message">
            Form submitted successfully! Session data cleared.
        </div>
    </form>

    <script>
        // Configuration
        const STORAGE_KEY = 'multiStepFormData';
        const SENSITIVE_FIELDS = ['dob', 'address'];

        // DOM Elements
        const form = document.getElementById('multiStepForm');
        const steps = document.querySelectorAll('.step');
        const successMessage = document.getElementById('successMessage');

        // Navigation Buttons
        const next1Btn = document.getElementById('next1Btn');
        const next2Btn = document.getElementById('next2Btn');
        const prev2Btn = document.getElementById('prev2Btn');
        const prev3Btn = document.getElementById('prev3Btn');

        /**
         * Saves non-sensitive form data to sessionStorage.
         * Sensitive fields (dob, address) are explicitly excluded.
         */
        function saveFormState() {
            const formData = {};
            
            // Iterate over all inputs in the form
            form.querySelectorAll('input').forEach(input => {
                // Only save if the input is not in the sensitive list
                if (!SENSITIVE_FIELDS.includes(input.name)) {
                    formData[input.name] = input.value;
                }
            });

            // Store the object in sessionStorage
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
        }

        /**
         * Loads non-sensitive form data from sessionStorage.
         * Populates inputs and updates the current step.
         */
        function loadFormState() {
            const storedData = sessionStorage.getItem(STORAGE_KEY);
            
            if (storedData) {
                const formData = JSON.parse(storedData);
                
                // Populate inputs
                for (const [key, value] of Object.entries(formData)) {
                    const input = document.querySelector(`input[name="${key}"]`);
                    if (input) {
                        input.value = value;
                    }
                }
            }
        }

        /**
         * Clears all data from sessionStorage.
         * Called upon successful submission.
         */
        function clearFormState() {
            sessionStorage.removeItem(STORAGE_KEY);
        }

        /**
         * Updates the UI to show the active step.
         */
        function showStep(stepIndex) {
            steps.forEach((step, index) => {
                if (index === stepIndex) {
                    step.classList.add('active');
                } else {
                    step.classList.remove('active');
                }
            });
        }

        /**
         * Renders the review content in Step 3.
         */
        function renderReview() {
            const reviewContent = document.getElementById('reviewContent');
            const firstName = document.getElementById('firstName').value;
            const lastName = document.getElementById('lastName').value;
            const email = document.getElementById('email').value;
            
            // Note: We do NOT display DOB or Address in the review
            reviewContent.innerHTML = `
                <p><strong>First Name:</strong> ${firstName}</p>
                <p><strong>Last Name:</strong> ${lastName}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><em>(Sensitive fields are not persisted or displayed)</em></p>
            `;
        }

        // --- Event Listeners ---

        // Initialize: Load data if available
        document.addEventListener('DOMContentLoaded', loadFormState);

        // Step 1 -> Step 2
        next1Btn.addEventListener('click', () => {
            saveFormState();
            showStep(1);
        });

        // Step 2 -> Step 3
        next2Btn.addEventListener('click', () => {
            saveFormState();
            renderReview();
            showStep(2);
        });

        // Step 2 -> Step 1
        prev2Btn.addEventListener('click', () => {
            showStep(0);
        });

        // Step 3 -> Step 2
        prev3Btn.addEventListener('click', () => {
            showStep(1);
        });

        // Form Submission
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // Clear sensitive data immediately
            clearFormState();
            
            // Show success message
            successMessage.style.display = 'block';
            
            // Optional: Reset form visually
            form.reset();
            showStep(0);
        });
    </script>
</body>
</html>