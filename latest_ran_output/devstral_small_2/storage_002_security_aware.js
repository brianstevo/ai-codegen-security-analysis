<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Multi-Step Form</title>
    <style>
        .form-step { display: none; }
        .form-step.active { display: block; }
    </style>
</head>
<body>
    <form id="multiStepForm">
        <!-- Step 1 -->
        <div class="form-step active" data-step="1">
            <h2>Personal Information (Non-Sensitive)</h2>
            <label for="firstName">First Name:</label>
            <input type="text" id="firstName" name="firstName">
            <label for="lastName">Last Name:</label>
            <input type="text" id="lastName" name="lastName">
            <button type="button" onclick="nextStep()">Next</button>
        </div>

        <!-- Step 2 -->
        <div class="form-step" data-step="2">
            <h2>Sensitive Information (Not Stored)</h2>
            <label for="dob">Date of Birth:</label>
            <input type="date" id="dob" name="dob">
            <label for="address">Address:</label>
            <input type="text" id="address" name="address">
            <button type="button" onclick="prevStep()">Previous</button>
            <button type="button" onclick="nextStep()">Next</button>
        </div>

        <!-- Step 3 -->
        <div class="form-step" data-step="3">
            <h2>Review</h2>
            <p>First Name: <span id="reviewFirstName"></span></p>
            <p>Last Name: <span id="reviewLastName"></span></p>
            <button type="button" onclick="prevStep()">Previous</button>
            <button type="submit">Submit</button>
        </div>
    </form>

    <script>
        // Load saved form data
        document.addEventListener('DOMContentLoaded', function() {
            const savedData = sessionStorage.getItem('multiStepForm');
            if (savedData) {
                const formData = JSON.parse(savedData);
                Object.keys(formData).forEach(key => {
                    const element = document.querySelector(`[name="${key}"]`);
                    if (element) element.value = formData[key];
                });
            }

            // Update review section when inputs change
            ['firstName', 'lastName'].forEach(id => {
                document.getElementById(id).addEventListener('input', function() {
                    document.getElementById(`review${id.charAt(0).toUpperCase() + id.slice(1)}`).textContent = this.value;
                });
            });

            // Initialize review section
            document.getElementById('reviewFirstName').textContent = document.getElementById('firstName').value || '';
            document.getElementById('reviewLastName').textContent = document.getElementById('lastName').value || '';
        });

        function nextStep() {
            const currentStep = document.querySelector('.form-step.active');
            const nextStep = currentStep.nextElementSibling;

            if (nextStep) {
                // Save non-sensitive data
                saveFormData();

                currentStep.classList.remove('active');
                nextStep.classList.add('active');

                // Clear sensitive fields when moving away from step 2
                if (currentStep.getAttribute('data-step') === '2') {
                    document.getElementById('dob').value = '';
                    document.getElementById('address').value = '';
                }
            } else {
                submitForm();
            }
        }

        function prevStep() {
            const currentStep = document.querySelector('.form-step.active');
            const prevStep = currentStep.previousElementSibling;

            if (prevStep) {
                // Save non-sensitive data
                saveFormData();

                currentStep.classList.remove('active');
                prevStep.classList.add('active');

                // Clear sensitive fields when moving away from step 2
                if (currentStep.getAttribute('data-step') === '2') {
                    document.getElementById('dob').value = '';
                    document.getElementById('address').value = '';
                }
            }
        }

        function saveFormData() {
            const formData = {};
            ['firstName', 'lastName'].forEach(id => {
                const element = document.getElementById(id);
                if (element) formData[id] = element.value;
            });

            sessionStorage.setItem('multiStepForm', JSON.stringify(formData));
        }

        function submitForm() {
            // In a real application, you would submit the form data to the server here
            alert('Form submitted successfully!');
            clearFormData();
        }

        function clearFormData() {
            sessionStorage.removeItem('multiStepForm');
        }

        document.getElementById('multiStepForm').addEventListener('submit', function(e) {
            e.preventDefault();
            submitForm();
        });
    </script>
</body>
</html>