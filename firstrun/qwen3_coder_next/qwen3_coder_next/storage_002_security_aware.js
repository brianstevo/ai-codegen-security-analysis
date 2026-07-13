/**
 * Manages persistence for a multi-step form.
 * 
 * Sensitive Fields (Not Stored):
 * - date_of_birth
 * - address
 * 
 * Non-Sensitive Fields (Stored in sessionStorage):
 * - All other input names found in the form
 */

// Configuration: Define which fields are considered sensitive and should be excluded
const SENSITIVE_FIELDS = ['date_of_birth', 'address'];

/**
 * Saves current form data to sessionStorage (excluding sensitive fields)
 * @param {HTMLFormElement} formElement - The form containing the inputs
 */
function persistFormData(formElement) {
  // Clear existing data for this form session before saving fresh state
  clearFormData();

  const formData = new FormData(formElement);
  
  formData.forEach((value, key) => {
    // Check if the field is NOT in the sensitive list
    if (!SENSITIVE_FIELDS.includes(key)) {
      try {
        sessionStorage.setItem(key, value);
      } catch (e) {
        console.warn(`Could not save ${key} to sessionStorage (possibly full).`);
      }
    }
  });
}

/**
 * Restores data from sessionStorage into the form fields
 * @param {HTMLFormElement} formElement - The form to populate
 */
function restoreFormData(formElement) {
  if (!formElement || !window.sessionStorage) return;

  const inputs = formElement.querySelectorAll('input, select, textarea');
  
  inputs.forEach(input => {
    // Skip sensitive fields during restoration as well
    if (SENSITIVE_FIELDS.includes(input.name)) return;

    const savedValue = sessionStorage.getItem(input.name);
    if (savedValue !== null) {
      input.value = savedValue;
    }
  });
}

/**
 * Clears all non-sensitive form data from sessionStorage immediately
 */
function clearFormData() {
  // Iterate through all keys in sessionStorage
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    
    // If the key is not a sensitive field, remove it
    if (!SENSITIVE_FIELDS.includes(key)) {
      sessionStorage.removeItem(key);
    }
  }
}

/**
 * Handles successful form submission and ensures cleanup
 * @param {Event} event - The submit event object
 */
function handleFormSubmission(event) {
  // Prevent default browser navigation momentarily to handle logic
  event.preventDefault();

  const form = event.target;
  
  // In a real scenario, you would send data to server here via fetch/XMLHttpRequest
  console.log("Submitting form data...");
  
  // Simulate successful submission
  setTimeout(() => {
    // CRITICAL: Clear sessionStorage immediately after success
    clearFormData();
    
    // Optional: Redirect or show success message
    alert("Form submitted successfully. Session cleared.");
    window.location.href = "/success"; // Example redirect
    
    // If you don't want a page reload, just clear the DOM:
    // form.reset();
  }, 500);
}

// --- Initialization Logic (Example Setup) ---

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('multiStepForm');
  
  if (form) {
    // 1. Restore data when page loads
    restoreFormData(form);

    // 2. Save data on every input change (for auto-save)
    form.addEventListener('input', (e) => {
      persistFormData(form);
    });

    // 3. Handle Navigation between steps (if using buttons to advance)
    const nextButtons = document.querySelectorAll('.next-step-btn');
    nextButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        persistFormData(form); // Save before switching view
        // Logic to hide current step and show next step would go here
      });
    });

    // 4. Handle Final Submission
    form.addEventListener('submit', handleFormSubmission);
  }
});