<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Secure Multi-Step Form Persistence</title>
    <style>
        body { font-family: sans-serif; display: flex; justify-content: center; padding: 2rem; background: #f4f4f9; }
        .form-container { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 400px; }
        .step { display: none; }
        .step.active { display: block; }
        .field-group { margin-bottom: 1rem; }
        label { display: block; margin-bottom: 0.5rem; font-weight: bold; }
        input { width: 100%; padding: 8px; box-sizing: border-box; }
        .nav-buttons { margin-top: 2rem; display: flex; justify-content: space-between; }
        button { padding: 10px 20px; cursor: pointer; }
        .status { margin-top: 1rem; color: green; font-weight: bold; text-align: center; }
    </style>
</head>
<body>

<div class="form-container">
    <form id="multiStepForm">
        <!-- Step 1: Non-Sensitive Data -->
        <div class="step active" data-step="1">
            <h3>Step 1: Basic Info</h3>
            <div class="field-group">
                <label for="username">Username (Stored)</label>
                <input type="text" name="username" id="username">
            </div>
            <div class="field-group">
                <label for="email">Email (Stored)</label>
                <input type="email" name="email" id="email">
            </div>
            <div class="nav-buttons">
                <span></span>
                <button type="button" onclick="navigate(1)">Next</button>
            </div>
        </div>

        <!-- Step 2: Sensitive Data -->
        <div class="step" data-step="2">
            <h3>Step 2: Private Info</h3>
            <div class="field-group">
                <label for="dob">Date of Birth (NOT Stored)</label>
                <input type="date" name="dob" id="dob">
            </div>
            <div class="field-group">
                <label for="address">Home Address (NOT Stored)</label>
                <input type="text" name="address" id="address">
            </div>
            <div class="nav-buttons">
                <button type="button" onclick="navigate(-1)">Back</button>
                <button type="button" onclick="navigate(1)">Next</button>
            </div>
        </div>

        <!-- Step 3: Finalize -->
        <div class="step" data-step="3">
            <h3>Step 3: Review & Submit</h3>
            <p>Please confirm your details and submit.</p>
            <div class="nav-buttons">
                <button type="button" onclick="navigate(-1)">Back</button>
                <button type="submit">Submit Form</button>
            </div>
        </div>
    </form>
    <div id="statusMessage" class="status"></div>
</div>

<script>
    /**
     * Configuration: Define which fields are sensitive and should NOT be persisted.
     */
    const SENSITIVE_FIELDS = ['dob', 'address'];
    const STORAGE_KEY = 'form_persistence_data';

    const form = document.getElementById('multiStepForm');
    const statusMessage = document.getElementById('statusMessage');

    /**
     * Persists non-sensitive form data to sessionStorage.
     */
    function persistFormData() {
        const formData = new FormData(form);
        const dataToStore = {};

        for (let [key, value] of formData.entries()) {
            // Only store if the field name is NOT in the sensitive list
            if (!SENSITIVE_FIELDS.includes(key)) {
                dataToStore[key] = value;
            }
        }

        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(dataToStore));
    }

    /**
     * Loads persisted data from sessionStorage back into the form.
     */
    function loadPersistedData() {
        const storedDataJson = sessionStorage.getItem(STORAGE_KEY);
        if (!storedDataJson) return;

        const storedData = JSON.parse(storedDataJson);
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
    async function handleFormSubmit(event) {
        event.preventDefault();
        
        // Simulate API call
        statusMessage.textContent = "Submitting...";
        
        await new Promise(resolve => setTimeout(resolve, 1000));

        // CRITICAL: Clear all sessionStorage data immediately after successful submission
        sessionStorage.removeItem(STORAGE_KEY);
        // Or use sessionStorage.clear() to wipe everything in the session
        sessionStorage.clear();

        statusMessage.textContent = "Form submitted successfully! Storage cleared.";
        form.style.display = 'none';
    }

    /**
     * Navigation logic for multi-step UI
     */
    function navigate(direction) {
        const steps = document.querySelectorAll('.step');
        let currentStepIndex = Array.from(steps).findIndex(s => s.classList.contains('active'));
        
        // Save data before moving to next/previous step (or simulating page reload)
        persistFormData();

        steps[currentStepIndex].classList.remove('active');
        const nextStepIndex = currentStepIndex + direction;
        
        if (nextStepIndex >= 0 && nextStepIndex < steps.length) {
            steps[nextStepIndex].classList.add('active');
        }
    }

    // Event Listeners
    form.addEventListener('submit', handleFormSubmit);

    // Auto-save on input change for non-sensitive fields
    form.addEventListener('input', (e) => {
        if (!SENSITIVE_FIELDS.includes(e.target.name)) {
            persistFormData();
        }
    });

    // Initialize form on page load
    window.addEventListener('DOMContentLoaded', () => {
        loadPersistedData();
    });
</script>

</body>
</html>