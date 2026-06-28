<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Multi-Step Form with Secure Persistence</title>
    <style>
        :root {
            --primary: #2563eb;
            --bg: #f8fafc;
            --surface: #ffffff;
            --text: #1e293b;
            --border: #e2e8f0;
        }

        body {
            font-family: system-ui, -apple-system, sans-serif;
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
            border-radius: 8px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            width: 100%;
            max-width: 500px;
        }

        h2 { margin-top: 0; }

        .step-indicator {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2rem;
            color: #64748b;
            font-size: 0.875rem;
        }

        .step-indicator span.active {
            color: var(--primary);
            font-weight: bold;
        }

        .form-step {
            display: none;
            animation: fadeIn 0.3s ease-in-out;
        }

        .form-step.active {
            display: block;
        }

        .form-group {
            margin-bottom: 1rem;
        }

        label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 500;
        }

        input, select {
            width: 100%;
            padding: 0.75rem;
            border: 1px solid var(--border);
            border-radius: 4px;
            box-sizing: border-box;
            font-size: 1rem;
        }

        input:focus {
            outline: 2px solid var(--primary);
            border-color: transparent;
        }

        .btn-group {
            display: flex;
            justify-content: space-between;
            margin-top: 1.5rem;
        }

        button {
            padding: 0.75rem 1.5rem;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 600;
            transition: background 0.2s;
        }

        .btn-primary {
            background-color: var(--primary);
            color: white;
        }

        .btn-primary:hover { background-color: #1d4ed8; }

        .btn-secondary {
            background-color: transparent;
            border: 1px solid var(--border);
            color: #64748b;
        }

        .btn-secondary:hover { background-color: #f1f5f9; }

        .hidden { display: none; }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(5px); }
            to { opacity: 1; transform: translateY(0); }
        }
    </style>
</head>
<body>

<div class="container">
    <h2>Registration Form</h2>
    
    <div class="step-indicator">
        <span id="ind-1" class="active">1. Account</span>
        <span id="ind-2">2. Profile</span>
        <span id="ind-3">3. Personal Info</span>
    </div>

    <form id="multiStepForm">
        <!-- Step 1: Non-Sensitive -->
        <div class="form-step active" data-step="1">
            <div class="form-group">
                <label for="username">Username</label>
                <input type="text" id="username" name="username" placeholder="johndoe">
            </div>
            <div class="form-group">
                <label for="email">Email Address</label>
                <input type="email" id="email" name="email" placeholder="john@example.com">
            </div>
        </div>

        <!-- Step 2: Non-Sensitive -->
        <div class="form-step" data-step="2">
            <div class="form-group">
                <label for="occupation">Occupation</label>
                <input type="text" id="occupation" name="occupation" placeholder="Developer">
            </div>
            <div class="form-group">
                <label for="interests">Interests</label>
                <select id="interests" name="interests">
                    <option value="tech">Technology</option>
                    <option value="art">Art</option>
                    <option value="science">Science</option>
                </select>
            </div>
        </div>

        <!-- Step 3: Sensitive (Not persisted) -->
        <div class="form-step" data-step="3">
            <div class="form-group">
                <label for="dob">Date of Birth</label>
                <input type="date" id="dob" name="dob">
            </div>
            <div class="form-group">
                <label for="address">Home Address</label>
                <input type="text" id="address" name="address" placeholder="123 Main St">
            </div>
        </div>

        <!-- Success Message -->
        <div class="form-step" data-step="success">
            <p style="color: green; text-align: center;">Form submitted successfully!</p>
            <p style="text-align: center; font-size: 0.9rem;">Session storage has been cleared.</p>
            <button type="button" onclick="location.reload()" class="btn-primary" style="width:100%">Reset</button>
        </div>

        <!-- Navigation Buttons -->
        <div class="btn-group" id="nav-buttons">
            <button type="button" id="prevBtn" class="btn-secondary hidden">Back</button>
            <button type="button" id="nextBtn" class="btn-primary">Next</button>
        </div>
    </form>
</div>

<script>
    /**
     * Configuration for field sensitivity.
     * Fields listed here will NOT be saved to sessionStorage.
     */
    const SENSITIVE_FIELDS = ['dob', 'address'];

    // DOM Elements
    const form = document.getElementById('multiStepForm');
    const steps = Array.from(document.querySelectorAll('.form-step'));
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const navButtons = document.getElementById('nav-buttons');
    const indicators = [
        document.getElementById('ind-1'),
        document.getElementById('ind-2'),
        document.getElementById('ind-3')
    ];

    let currentStepIndex = 0;

    // --- Core Logic Functions ---

    /**
     * Saves non-sensitive form data to sessionStorage.
     */
    function saveFormData() {
        const formData = new FormData(form);
        const safeData = {};

        for (let [key, value] of formData.entries()) {
            // Filter out sensitive fields
            if (!SENSITIVE_FIELDS.includes(key)) {
                safeData[key] = value;
            }
        }

        try {
            sessionStorage.setItem('formProgress', JSON.stringify(safeData));
        } catch (e) {
            console.error("Failed to save to session storage", e);
        }
    }

    /**
     * Loads data from sessionStorage and populates non-sensitive fields.
     */
    function loadFormData() {
        const storedData = sessionStorage.getItem('formProgress');
        if (!storedData) return;

        try {
            const parsedData = JSON.parse(storedData);
            
            for (const [key, value] of Object.entries(parsedData)) {
                const input = form.elements[key];
                if (input && !SENSITIVE_FIELDS.includes(key)) {
                    input.value = value;
                }
            }
        } catch (e) {
            console.error("Failed to parse session data", e);
        }
    }

    /**
     * Clears all form data from sessionStorage.
     */
    function clearSessionData() {
        sessionStorage.removeItem('formProgress');
    }

    // --- UI Handling ---

    function updateUI() {
        // Toggle Step Visibility
        steps.forEach((step, index) => {
            if (index === currentStepIndex) {
                step.classList.add('active');
            } else {
                step.classList.remove('active');
            }
        });

        // Update Indicators
        indicators.forEach((ind, index) => {
            if (index < currentStepIndex) ind.classList.add('active'); // Keep previous active or style differently
            if (index === currentStepIndex) ind.classList.add('active');
            else ind.classList.remove('active');
        });

        // Button Visibility
        if (currentStepIndex === 0) {
            prevBtn.classList.add('hidden');
        } else {
            prevBtn.classList.remove('hidden');
        }

        if (currentStepIndex === steps.length - 2) { // Second to last step is the last input step
            nextBtn.textContent = 'Submit';
        } else {
            nextBtn.textContent = 'Next';
        }
    }

    function handleNext() {
        // If we are on the last input step (Step 3), submit
        if (currentStepIndex === steps.length - 2) {
            handleSubmit();
            return;
        }

        saveFormData();
        currentStepIndex++;
        updateUI();
    }

    function handlePrev() {
        if (currentStepIndex > 0) {
            currentStepIndex--;
            updateUI();
        }
    }

    function handleSubmit() {
        // In a real app, you would gather ALL data here (including sensitive) 
        // and send it to the server.
        
        const formData = new FormData(form);
        const allData = Object.fromEntries(formData.entries());
        
        console.log("Submitting full form data:", allData);

        // Simulate network request
        setTimeout(() => {
            // 1. Clear Session Storage immediately on success
            clearSessionData();
            
            // 2. Show Success Step
            currentStepIndex = steps.length - 1;
            navButtons.classList.add('hidden');
            updateUI();
        }, 500);
    }

    // --- Initialization ---

    document.addEventListener('DOMContentLoaded', () => {
        loadFormData();
        
        nextBtn.addEventListener('click', handleNext);
        prevBtn.addEventListener('click', handlePrev);
    });

</script>
</body>
</html>