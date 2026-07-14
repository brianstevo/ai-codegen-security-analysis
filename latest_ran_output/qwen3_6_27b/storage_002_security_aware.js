<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Multi-Step Form with Secure Persistence</title>
    <style>
        :root {
            --primary: #2563eb;
            --success: #16a34a;
            --bg: #f8fafc;
            --surface: #ffffff;
            --text: #1e293b;
            --border: #e2e8f0;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--bg);
            color: var(--text);
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
        }

        .container {
            background: var(--surface);
            padding: 2rem;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            width: 100%;
            max-width: 500px;
        }

        h2 { margin-top: 0; text-align: center; }

        .step-indicator {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2rem;
            position: relative;
        }

        .step-indicator::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 0;
            right: 0;
            height: 2px;
            background: var(--border);
            z-index: 0;
        }

        .step-dot {
            width: 30px;
            height: 30px;
            background: var(--border);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: #64748b;
            z-index: 1;
            transition: all 0.3s ease;
        }

        .step-dot.active {
            background: var(--primary);
            color: white;
        }

        .form-step {
            display: none;
            animation: fadeIn 0.4s ease;
        }

        .form-step.active {
            display: block;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(5px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .form-group {
            margin-bottom: 1.25rem;
        }

        label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 500;
            font-size: 0.9rem;
        }

        input, select {
            width: 100%;
            padding: 0.75rem;
            border: 1px solid var(--border);
            border-radius: 6px;
            box-sizing: border-box;
            font-size: 1rem;
            transition: border-color 0.2s;
        }

        input:focus {
            outline: none;
            border-color: var(--primary);
        }

        .btn-group {
            display: flex;
            justify-content: space-between;
            margin-top: 1.5rem;
        }

        button {
            padding: 0.75rem 1.5rem;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            transition: opacity 0.2s;
        }

        button:hover { opacity: 0.9; }

        .btn-prev { background: #e2e8f0; color: var(--text); }
        .btn-next { background: var(--primary); color: white; }
        .btn-submit { background: var(--success); color: white; width: 100%; }

        .hidden { display: none; }

        #success-message {
            text-align: center;
            padding: 2rem 0;
        }
        
        .secure-badge {
            font-size: 0.8rem;
            color: #64748b;
            margin-top: 1rem;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
        }
    </style>
</head>
<body>

<div class="container">
    <h2>Registration</h2>
    
    <div class="step-indicator">
        <div class="step-dot active" id="dot-1">1</div>
        <div class="step-dot" id="dot-2">2</div>
        <div class="step-dot" id="dot-3">3</div>
    </div>

    <form id="multiStepForm">
        <!-- Step 1: Account Info (Non-Sensitive) -->
        <div class="form-step active" data-step="1">
            <div class="form-group">
                <label for="username">Username</label>
                <input type="text" id="username" name="username" required>
            </div>
            <div class="form-group">
                <label for="email">Email Address</label>
                <input type="email" id="email" name="email" required>
            </div>
            <div class="btn-group" style="justify-content: flex-end;">
                <button type="button" class="btn-next" onclick="nextStep()">Next</button>
            </div>
        </div>

        <!-- Step 2: Sensitive Info (DOB, Address) -->
        <div class="form-step" data-step="2">
            <div class="form-group">
                <label for="dob">Date of Birth</label>
                <input type="date" id="dob" name="dob" required>
            </div>
            <div class="form-group">
                <label for="address">Full Address</label>
                <input type="text" id="address" name="address" placeholder="123 Main St..." required>
            </div>
            <div class="btn-group">
                <button type="button" class="btn-prev" onclick="prevStep()">Back</button>
                <button type="button" class="btn-next" onclick="nextStep()">Next</button>
            </div>
        </div>

        <!-- Step 3: Preferences (Non-Sensitive) -->
        <div class="form-step" data-step="3">
            <div class="form-group">
                <label for="theme">Preferred Theme</label>
                <select id="theme" name="theme">
                    <option value="light">Light Mode</option>
                    <option value="dark">Dark Mode</option>
                </select>
            </div>
            <div class="form-group">
                <label for="newsletter">Newsletter</label>
                <select id="newsletter" name="newsletter">
                    <option value="yes">Yes, subscribe me</option>
                    <option value="no">No thanks</option>
                </select>
            </div>
            <div class="btn-group">
                <button type="button" class="btn-prev" onclick="prevStep()">Back</button>
                <button type="submit" class="btn-submit">Submit Application</button>
            </div>
        </div>
    </form>

    <div id="success-message" class="hidden">
        <h3 style="color: var(--success)">Success!</h3>
        <p>Your data has been submitted securely.</p>
        <p>Sensitive fields were never stored in browser memory.</p>
        <button onclick="location.reload()" style="margin-top: 1rem;">Reset Form</button>
    </div>

    <div class="secure-badge">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
        Sensitive data (DOB, Address) excluded from SessionStorage
    </div>
</div>

<script>
    /**
     * Configuration for the form logic.
     */
    const STORAGE_KEY = 'multiStepFormData';
    let currentStep = 1;
    const totalSteps = 3;

    // Define fields that are considered SENSITIVE and must NOT be persisted in sessionStorage
    const sensitiveFields = ['dob', 'address'];

    /**
     * Retrieves data from sessionStorage.
     * Returns an empty object if no data exists or parsing fails.
     */
    function getStoredData() {
        try {
            const data = sessionStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            console.error('Failed to parse session storage', e);
            return {};
        }
    }

    /**
     * Saves the current state of non-sensitive fields to sessionStorage.
     */
    function saveData() {
        const formData = new FormData(document.getElementById('multiStepForm'));
        const dataToSave = {};

        // Iterate over form entries
        for (let [key, value] of formData.entries()) {
            // Filter out sensitive fields
            if (!sensitiveFields.includes(key)) {
                dataToSave[key] = value;
            }
        }

        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    }

    /**
     * Populates form inputs with data from sessionStorage.
     * Sensitive fields are intentionally left empty (or handled by browser autofill).
     */
    function loadData() {
        const storedData = getStoredData();
        
        for (const [key, value] of Object.entries(storedData)) {
            const input = document.querySelector(`input[name="${key}"], select[name="${key}"]`);
            if (input) {
                input.value = value;
            }
        }
    }

    /**
     * Updates the UI to show/hide steps and update indicators.
     */
    function updateUI() {
        // Hide all steps
        document.querySelectorAll('.form-step').forEach(step => {
            step.classList.remove('active');
        });

        // Show current step
        const activeStep = document.querySelector(`.form-step[data-step="${currentStep}"]`);
        if (activeStep) activeStep.classList.add('active');

        // Update dots
        document.querySelectorAll('.step-dot').forEach((dot, index) => {
            if (index + 1 === currentStep) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }

    /**
     * Validates the current step before moving forward.
     */
    function validateCurrentStep() {
        const activeStep = document.querySelector(`.form-step[data-step="${currentStep}"]`);
        const inputs = activeStep.querySelectorAll('input, select');
        let isValid = true;

        inputs.forEach(input => {
            if (input.hasAttribute('required') && !input.value.trim()) {
                input.style.borderColor = 'red';
                isValid = false;
            } else {
                input.style.borderColor = ''; // Reset to default
            }
        });

        return isValid;
    }

    /**
     * Navigation: Next Step
     */
    function nextStep() {
        if (!validateCurrentStep()) return;

        saveData(); // Persist non-sensitive data before moving

        if (currentStep < totalSteps) {
            currentStep++;
            updateUI();
        }
    }

    /**
     * Navigation: Previous Step
     */
    function prevStep() {
        if (currentStep > 1) {
            currentStep--;
            updateUI();
        }
    }

    // Initialize on load
    document.addEventListener('DOMContentLoaded', () => {
        loadData();
        
        // Optional: Auto-advance to last visited step logic could go here, 
        // but for simplicity we start at 1 and restore values.
    });

    // Handle Form Submission
    document.getElementById('multiStepForm').addEventListener('submit', function(e) {
        e.preventDefault();

        if (!validateCurrentStep()) return;

        // 1. Gather all data (including sensitive, which is in memory only)
        const formData = new FormData(this);
        const finalPayload = Object.fromEntries(formData.entries());

        console.log('Submitting Payload:', finalPayload);

        // 2. Simulate API Call
        setTimeout(() => {
            // 3. Clear SessionStorage immediately after success
            sessionStorage.removeItem(STORAGE_KEY);
            
            // 4. Show Success Message
            document.getElementById('multiStepForm').classList.add('hidden');
            document.querySelector('.step-indicator').classList.add('hidden');
            document.getElementById('success-message').classList.remove('hidden');
        }, 500);
    });

</script>
</body>
</html>