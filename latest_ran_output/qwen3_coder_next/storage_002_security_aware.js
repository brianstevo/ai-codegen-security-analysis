/**
 * Manages persistence for a multi-step form.
 * 
 * Sensitive Fields (NOT stored):
 * - date_of_birth
 * - address
 * 
 * Non-Sensitive Fields (Stored in sessionStorage):
 * - All other input values (e.g., name, email, preferences)
 */

// Configuration: Define which fields are considered sensitive and should be excluded
const SENSITIVE_FIELDS = ['date_of_birth', 'address'];

/**
 * Saves the current step's form data to sessionStorage.
 * Only non-sensitive fields are persisted.
 * 
 * @param {HTMLFormElement} formElement - The form or fieldset containing the inputs to save
 * @param {string} stepKey - A unique identifier for the current form step (e.g., "step1", "personal_info")
 */
function persistFormData(formElement, stepKey) {
    if (!formElement || !stepKey) return;

    const formData = new FormData(formElement);
    const dataToSave = {};

    // Iterate through all entries in the form
    for (const [key, value] of formData.entries()) {
        // Check if the field is NOT in the sensitive list
        if (!SENSITIVE_FIELDS.includes(key)) {
            dataToSave[key] = value;
        }
    }

    // Store the non-sensitive data under the specific step key
    try {
        sessionStorage.setItem(stepKey, JSON.stringify(dataToSave));
    } catch (e) {
        console.warn('SessionStorage is full or unavailable. Data not saved for step:', stepKey);
    }
}

/**
 * Restores previously saved data to a specific form step.
 * 
 * @param {HTMLFormElement} formElement - The form or fieldset to populate
 * @param {string} stepKey - The unique identifier for the current form step
 */
function restoreFormData(formElement, stepKey) {
    try {
        const storedData = sessionStorage.getItem(stepKey);
        
        if (!storedData) return;

        const data = JSON.parse(storedData);
        const inputs = formElement.querySelectorAll('input, select, textarea');

        inputs.forEach(input => {
            // Skip sensitive fields even if they exist in the DOM
            if (SENSITIVE_FIELDS.includes(input.name)) return;

            if (data.hasOwnProperty(input.name)) {
                // Handle different input types appropriately
                if (input.type === 'checkbox' || input.type === 'radio') {
                    input.checked = data[input.name] === input.value;
                } else {
                    input.value = data[input.name];
                }
            }
        });
    } catch (e) {
        console.error('Error restoring form data for step:', stepKey, e);
    }
}

/**
 * Clears all form-related data from sessionStorage.
 * Should be called immediately after a successful form submission.
 */
function clearFormSessionData() {
    // Option 1: Clear only known specific keys if you want to be granular
    // const steps = ['step1', 'step2', 'step3']; 
    // steps.forEach(step => sessionStorage.removeItem(step));

    // Option 2: Clear all session storage (as requested)
    try {
        sessionStorage.clear();
        console.log('SessionStorage cleared successfully after form submission.');
    } catch (e) {
        console.error('Failed to clear SessionStorage:', e);
    }
}

// --- Example Usage Implementation ---

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('multiStepForm');
    
    if (!form) return;

    // 1. Restore data on page load
    const currentStepId = form.dataset.currentStep || 'step1';
    restoreFormData(form, currentStepId);

    // 2. Save data when navigating to a new step (e.g., clicking "Next")
    form.addEventListener('click', (e) => {
        if (e.target.matches('button[type="next"]')) {
            const currentStep = e.target.closest('[data-step]');
            if (currentStep) {
                persistFormData(form, currentStep.dataset.step);
            }
        }
    });

    // 3. Handle Form Submission
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Optional: Save the final step data before submitting
        persistFormData(form, 'final_step');

        // Simulate API call
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerText;
        submitBtn.innerText = 'Submitting...';
        submitBtn.disabled = true;

        setTimeout(() => {
            // --- SUCCESS SCENARIO ---
            
            // 1. Clear all sessionStorage immediately
            clearFormSessionData();

            // 2. Show success message
            form.innerHTML = `
                <div style="text-align: center; padding: 2rem;">
                    <h2>Submission Successful!</h2>
                    <p>Your data has been processed and session memory cleared.</p>
                    <button onclick="location.reload()">Start Over</button>
                </div>
            `;
            
            // Reset button state if we were to keep the form (not applicable here but good practice)
        }, 1500);
    });
});