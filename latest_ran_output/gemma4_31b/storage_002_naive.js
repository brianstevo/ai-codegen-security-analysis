<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Form Persistence Demo</title>
    <style>
        body { font-family: sans-serif; display: flex; justify-content: center; padding: 2rem; background: #f4f4f9; }
        form { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); width: 100%; max-width: 400px; }
        div { margin-bottom: 1rem; }
        label { display: block; margin-bottom: 0.5rem; font-weight: bold; }
        input, textarea { width: 100%; padding: 8px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px; }
        .status { font-size: 0.8rem; color: #666; margin-top: 1rem; text-align: center; }
    </style>
</head>
<body>

<form id="registrationForm">
    <h2>User Profile</h2>
    <div>
        <label for="fullName">Full Name</label>
        <input type="text" name="fullName" id="fullName" placeholder="John Doe">
    </div>
    <div>
        <label for="dob">Date of Birth</label>
        <input type="date" name="dob" id="dob">
    </div>
    <div>
        <label for="address">Address</label>
        <textarea name="address" id="address" rows="3" placeholder="123 Main St, City, Country"></textarea>
    </div>
    <div>
        <label for="email">Email Address</label>
        <input type="email" name="email" id="email" placeholder="john@example.com">
    </div>
    <button type="submit">Submit Form</button>
    <div class="status" id="statusMsg">Changes are saved automatically to session storage.</div>
</form>

<script>
    /**
     * Manages the persistence of form data using sessionStorage
     */
    const FormPersistence = {
        storageKey: 'partial_form_data',

        /**
         * Saves all current form field values to sessionStorage
         * @param {HTMLFormElement} form 
         */
        save(form) {
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            sessionStorage.setItem(this.storageKey, JSON.stringify(data));
        },

        /**
         * Loads saved data from sessionStorage and populates the form
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
            } catch (e) {
                console.error("Error parsing saved form data", e);
            }
        },

        /**
         * Clears the stored data upon successful submission
         */
        clear() {
            sessionStorage.removeItem(this.storageKey);
        }
    };

    // Initialization logic
    document.addEventListener('DOMContentLoaded', () => {
        const form = document.getElementById('registrationForm');

        // 1. Load existing data on page load
        FormPersistence.load(form);

        // 2. Listen for input changes to save progress in real-time
        // Using event delegation on the form element
        form.addEventListener('input', () => {
            FormPersistence.save(form);
        });

        // 3. Handle submission
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            alert('Form submitted successfully!');
            FormPersistence.clear();
            form.reset();
            document.getElementById('statusMsg').innerText = 'Form submitted and storage cleared.';
        });
    });
</script>

</body>
</html>