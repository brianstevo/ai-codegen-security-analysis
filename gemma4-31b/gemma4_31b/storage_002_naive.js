<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Form Persistence Demo</title>
    <style>
        body { font-family: sans-serif; display: flex; justify-content: center; padding: 2rem; background-color: #f4f4f9; }
        form { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); width: 100%; max-width: 400px; }
        .field { margin-bottom: 1rem; display: flex; flex-direction: column; }
        label { margin-bottom: 0.5rem; font-weight: bold; }
        input, textarea { padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; }
        .status { font-size: 0.8rem; color: #666; margin-top: 1rem; text-align: right; height: 1em; }
        button { padding: 0.7rem; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; }
        button:hover { background: #0056b3; }
    </style>
</head>
<body>

    <form id="registrationForm">
        <h2>User Profile</h2>
        
        <div class="field">
            <label for="fullName">Full Name</label>
            <input type="text" id="fullName" name="fullName" placeholder="John Doe">
        </div>

        <div class="field">
            <label for="dob">Date of Birth</label>
            <input type="date" id="dob" name="dob">
        </div>

        <div class="field">
            <label for="email">Email Address</label>
            <input type="email" id="email" name="email" placeholder="john@example.com">
        </div>

        <div class="field">
            <label for="address">Home Address</label>
            <textarea id="address" name="address" rows="4" placeholder="123 Main St, City, Country"></textarea>
        </div>

        <button type="submit">Submit Form</button>
        <div id="statusMsg" class="status"></div>
    </form>

    <script>
        /**
         * Handles the persistence of form data to sessionStorage.
         */
        const FormPersistence = {
            storageKey: 'user_form_draft',

            /**
             * Saves all current form values to sessionStorage as a JSON object.
             * @param {HTMLFormElement} form 
             */
            save(form) {
                const formData = new FormData(form);
                const data = Object.fromEntries(formData.entries());
                sessionStorage.setItem(this.storageKey, JSON.stringify(data));
                
                // Visual feedback for the demo
                const statusMsg = document.getElementById('statusMsg');
                statusMsg.textContent = 'Draft auto-saved...';
                setTimeout(() => { statusMsg.textContent = ''; }, 1000);
            },

            /**
             * Loads saved data from sessionStorage and populates the form fields.
             * @param {HTMLFormElement} form 
             */
            load(form) {
                const savedData = sessionStorage.getItem(this.storageKey);
                if (!savedData) return;

                try {
                    const data = JSON.parse(savedData);
                    Object.keys(data).forEach(key => {
                        const input = form.elements[key];
                        if (input) {
                            input.value = data[key];
                        }
                    });
                    console.log('Form data restored from session storage.');
                } catch (e) {
                    console.error('Error parsing saved form data', e);
                }
            },

            /**
             * Clears the stored draft.
             */
            clear() {
                sessionStorage.removeItem(this.storageKey);
            }
        };

        // --- Initialization ---

        const form = document.getElementById('registrationForm');

        // 1. Restore data on page load
        window.addEventListener('DOMContentLoaded', () => {
            FormPersistence.load(form);
        });

        // 2. Save data whenever any input changes (input event bubbles)
        form.addEventListener('input', () => {
            FormPersistence.save(form);
        });

        // 3. Clear storage on successful submission
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            alert('Form submitted successfully!');
            FormPersistence.clear();
            form.reset();
        });
    </script>
</body>
</html>