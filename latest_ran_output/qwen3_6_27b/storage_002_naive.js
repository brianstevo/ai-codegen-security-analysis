<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Form Persistence Demo</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #f4f4f9;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
        }

        .container {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            width: 100%;
            max-width: 400px;
        }

        h2 { margin-top: 0; color: #333; }

        .form-group { margin-bottom: 1rem; }

        label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: bold;
            color: #555;
        }

        input, textarea {
            width: 100%;
            padding: 0.75rem;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-sizing: border-box; /* Ensures padding doesn't affect width */
            font-size: 1rem;
        }

        textarea { resize: vertical; min-height: 80px; }

        .actions {
            display: flex;
            gap: 10px;
            margin-top: 1.5rem;
        }

        button {
            padding: 0.75rem 1rem;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 1rem;
            flex: 1;
            transition: background 0.2s;
        }

        .btn-save { background-color: #007bff; color: white; }
        .btn-save:hover { background-color: #0056b3; }

        .btn-clear { background-color: #dc3545; color: white; }
        .btn-clear:hover { background-color: #a71d2a; }

        .status {
            margin-top: 1rem;
            font-size: 0.9rem;
            text-align: center;
            min-height: 1.2em;
            color: #28a745;
        }
    </style>
</head>
<body>

<div class="container">
    <h2>User Registration</h2>
    <form id="userForm">
        <div class="form-group">
            <label for="fullName">Full Name</label>
            <input type="text" id="fullName" name="fullName" placeholder="John Doe">
        </div>

        <div class="form-group">
            <label for="dob">Date of Birth</label>
            <input type="date" id="dob" name="dob">
        </div>

        <div class="form-group">
            <label for="address">Address</label>
            <textarea id="address" name="address" placeholder="123 Main St, City, Country"></textarea>
        </div>

        <div class="actions">
            <button type="submit" class="btn-save">Save & Continue</button>
            <button type="button" id="clearBtn" class="btn-clear">Clear Data</button>
        </div>
    </form>
    <div id="statusMessage" class="status"></div>
</div>

<script>
    /**
     * Saves the current state of the form inputs to sessionStorage.
     */
    function saveFormToSession() {
        const form = document.getElementById('userForm');
        const formData = new FormData(form);
        
        // Convert FormData to a plain object for storage
        const dataToSave = {};
        formData.forEach((value, key) => {
            dataToSave[key] = value;
        });

        try {
            sessionStorage.setItem('partialForm', JSON.stringify(dataToSave));
            showStatus('Data saved to session.');
        } catch (e) {
            console.error("Failed to save to session storage", e);
            showStatus('Error saving data.', true);
        }
    }

    /**
     * Retrieves data from sessionStorage and populates the form fields.
     */
    function loadFormFromSession() {
        const savedData = sessionStorage.getItem('partialForm');
        
        if (!savedData) return;

        try {
            const parsedData = JSON.parse(savedData);
            
            // Iterate over keys in the saved object and set input values
            for (const key in parsedData) {
                const inputElement = document.querySelector(`[name="${key}"]`);
                if (inputElement) {
                    inputElement.value = parsedData[key];
                }
            }
        } catch (e) {
            console.error("Failed to parse session data", e);
        }
    }

    /**
     * Clears the sessionStorage and resets the form.
     */
    function clearSessionAndForm() {
        sessionStorage.removeItem('partialForm');
        document.getElementById('userForm').reset();
        showStatus('Data cleared.');
    }

    // Helper to show feedback text
    function showStatus(msg, isError = false) {
        const statusEl = document.getElementById('statusMessage');
        statusEl.textContent = msg;
        statusEl.style.color = isError ? 'red' : '#28a745';
        
        // Clear message after 3 seconds
        setTimeout(() => {
            statusEl.textContent = '';
        }, 3000);
    }

    // --- Event Listeners ---

    document.addEventListener('DOMContentLoaded', () => {
        // 1. Load data immediately when page opens
        loadFormFromSession();

        const form = document.getElementById('userForm');
        
        // 2. Save on Submit (Prevent actual submission for demo purposes)
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            saveFormToSession();
            alert("Form data saved! You can now navigate away or refresh.");
        });

        // 3. Clear button logic
        document.getElementById('clearBtn').addEventListener('click', clearSessionAndForm);
    });

</script>

</body>
</html>