<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Secure Multi-Step Form Persistence</title>
    <style>
        body { font-family: sans-serif; display: flex; justify-content: center; padding: 2rem; background: #f4f4f9; }
        .form-container { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 100%; max-width: 500px; }
        .step { display: none; }
        .step.active { display: block; }
        .form-group { margin-bottom: 1rem; }
        label { display: block; margin-bottom: .5rem; font-weight: bold; }
        input { width: 100%; padding: .5rem; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px; }
        .nav-buttons { margin-top: 1.5rem; display: flex; justify-content: space-between; }
        button { padding: .5rem 1rem; cursor: pointer; border-radius: 4px; border: none; background: #007bff; color: white; }
        button:disabled { background: #ccc; }
        .sensitive-label { color: #d9534f; font-size: 0.8rem; font-style: italic; }
    </style>
</head>
<body>

<div class="form-container">
    <form id="multiStepForm">
        <!-- Step 1: General Info (Non-Sensitive) -->
        <div class="step active" data-step="1">
            <h2>Step 1: Basic Info</h2>
            <div class="form-group">
                <label for="fullName">Full Name</label>
                <input type="text" name="fullName" id="fullName">
            </div>
            <div class="form-group">
                <label for="email">Email Address</label>
                <input type="email" name="email" id="email">
            </div>
            <div class="nav-buttons">
                <span></span>
                <button type="button" onclick="navigate(1)">Next</button>
            </div>
        </div>

        <!-- Step 2: Private Info (Sensitive) -->
        <div class="step" data-step="2">
            <h2>Step 2: Private Details</h2>
            <p class="sensitive-label">Note: These fields are not persisted in session storage for security.</p>
            <div class="form-group">
                <label for="dob">Date of Birth</label>
                <input type="date" name="dob" id="dob">
            </div>
            <div class="form-group">
                <label for="address">Home Address</label>
                <input type="text" name="address" id="address">
            </div>
            <div class="nav-buttons">
                <button type="button" onclick="navigate(-1)">Previous</button>
                <button type="button" onclick="navigate(1)">Next</button>
            </div>
        </div>

        <!-- Step 3: Preferences (Non-Sensitive) -->
        <div class="step" data-step="3">
            <h2>Step 3: Preferences</h2>
            <div class="form-group">
                <label for="newsletter">Newsletter Preference</label>
                <input type="text" name="newsletter" id="newsletter" placeholder="Yes/No">
            </div>
            <div class="nav-buttons">
                <button type="button" onclick="navigate(-1)">Previous</button>
                <button type="submit">Submit Form</button>
            </div>
        </div>
    </form>
</div>

<script>
    /**
     * Configuration: Define which field names are sensitive.
     * These will be ignored by the persistence logic.
     */
    const SENSITIVE_FIELDS = ['dob', 'address'];
    const STORAGE_KEY = 'multi_step_form_data';

    /**
     * Persists non-sensitive form data to sessionStorage.
     */
    function persistFormData() {
        const form = document.getElementById('multiStepForm');
        const formData = new FormData(form);
        const dataToStore = {};

        for (let [key, value] of formData.entries()) {
            // Only store if the field is NOT in the sensitive list
            if (!SENSITIVE_FIELDS.includes(key)) {
                dataToStore[key] = value;
            }
        }

        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(dataToStore));
    }

    /**
     * Loads non-sensitive data from sessionStorage back into the form.
     */
    function loadFormData() {
        const storedDataJson = sessionStorage.getItem(STORAGE_KEY);
        if (!storedDataJson) return;

        const storedData = JSON.parse(storedDataJson);
        const form = document.getElementById('multiStepForm');

        Object.keys(storedData).forEach(key => {
            const input = form.elements[key];
            if (input) {
                input.value = storedData[key];
            }
        });
    }

    /**
     * Handles the final submission and clears storage.
     */
    function handleFormSubmit(event) {
        event.preventDefault();
        
        // Simulate API call
        alert('Form submitted successfully! Session data is now being cleared.');
        
        // Requirement: Clear all sessionStorage immediately after successful submission
        sessionStorage.removeItem(STORAGE_KEY); 
        // Or use sessionStorage.clear() to wipe everything in the domain's session storage
        sessionStorage.clear();

        // Reset form and UI
        event.target.reset();
        navigateReset();
    }

    /**
     * Navigation logic for multi-step visibility
     */
    let currentStep = 1;
    function navigate(direction) {
        const steps = document.querySelectorAll('.step');
        
        // Save data before moving to next/prev step (or on page reload)
        persistFormData();

        steps[currentStep - 1].classList.remove('active');
        currentStep += direction;
        steps[currentStep - 1].classList.add('active');
    }

    function navigateReset() {
        const steps = document.querySelectorAll('.step');
        steps.forEach(s => s.classList.remove('active'));
        currentStep = 1;
        steps[0].classList.add('active');
    }

    // Initialize
    window.addEventListener('DOMContentLoaded', () => {
        loadFormData();

        const form = document.getElementById('multiStepForm');
        
        // Save data automatically as user types (optional, but improves UX)
        form.addEventListener('input', persistFormData);
        
        // Handle submission
        form.addEventListener('submit', handleFormSubmit);
    });
</script>

</body>
</html>