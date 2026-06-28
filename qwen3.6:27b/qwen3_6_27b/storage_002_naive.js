<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Persistent Form Data</title>
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

        h2 {
            margin-top: 0;
            color: #333;
        }

        .form-group {
            margin-bottom: 1rem;
        }

        label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 600;
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

        textarea {
            resize: vertical;
            min-height: 80px;
        }

        .button-group {
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
            transition: background-color 0.2s;
        }

        .btn-save {
            background-color: #007bff;
            color: white;
        }
        .btn-save:hover { background-color: #0056b3; }

        .btn-clear {
            background-color: #dc3545;
            color: white;
        }
        .btn-clear:hover { background-color: #a71d2a; }

        .status-msg {
            margin-top: 1rem;
            text-align: center;
            font-size: 0.9rem;
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

        <div class="button-group">
            <button type="submit" class="btn-save">Save & Continue</button>
            <button type="button" id="clearBtn" class="btn-clear">Clear Data</button>
        </div>
    </form>
    <div id="statusMsg" class="status-msg"></div>
</div>

<script>
    /**
     * Saves the current state of the form inputs to sessionStorage.
     */
    function saveFormData() {
        const form = document.getElementById('userForm');
        const formData = new FormData(form);
        
        // Convert FormData object to a plain object for storage
        const dataToSave = {};
        formData.forEach((value, key) => {
            dataToSave[key] = value;
        });

        try {
            sessionStorage.setItem('partialForm', JSON.stringify(dataToSave));
            showStatus('Data saved successfully!');
        } catch (e) {
            console.error("Failed to save to session storage", e);
            showStatus('Error saving data.');
        }
    }

    /**
     * Retrieves data from sessionStorage and populates the form fields.
     */
    function loadFormData() {
        const savedData = sessionStorage.getItem('partialForm');
        
        if (savedData) {
            try {
                const parsedData = JSON.parse(savedData);
                
                // Iterate over keys in the saved object and set input values
                for (const key in parsedData) {
                    const element = document.querySelector(`[name="${key}"]`);
                    if (element) {
                        element.value = parsedData[key];
                    }
                }
                showStatus('Previous data restored.');
            } catch (e) {
                console.error("Failed to parse session storage", e);
            }
        }
    }

    /**
     * Clears the sessionStorage and resets the form.
     */
    function clearFormData() {
        sessionStorage.removeItem('partialForm');
        document.getElementById('userForm').reset();
        showStatus('Data cleared.');
    }

    // Helper to show temporary status messages
    function showStatus(message) {
        const msgEl = document.getElementById('statusMsg');
        msgEl.textContent = message;
        setTimeout(() => {
            msgEl.textContent = '';
        }, 3000);
    }

    // --- Event Listeners ---

    document.addEventListener('DOMContentLoaded', () => {
        // 1. Load data immediately when page opens
        loadFormData();

        const form = document.getElementById('userForm');
        
        // 2. Save data on submit (preventing actual submission for this demo)
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            saveFormData();
            
            // Simulate navigation to show persistence works
            // In a real app, you would redirect here: window.location.href = '/next-page';
            alert("Data saved! If you refresh now, the data will remain.");
        });

        // 3. Clear button logic
        document.getElementById('clearBtn').addEventListener('click', clearFormData);
    });

</script>

</body>
</html>