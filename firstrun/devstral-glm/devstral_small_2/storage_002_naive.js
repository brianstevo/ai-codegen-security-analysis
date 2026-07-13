<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Form with Session Storage</title>
</head>
<body>
    <form id="userForm">
        <label for="name">Name:</label>
        <input type="text" id="name" name="name"><br><br>

        <label for="dob">Date of Birth:</label>
        <input type="date" id="dob" name="dob"><br><br>

        <label for="address">Address:</label>
        <textarea id="address" name="address"></textarea><br><br>

        <button type="submit">Submit</button>
    </form>

    <script>
        document.addEventListener('DOMContentLoaded', function() {
            const form = document.getElementById('userForm');

            // Load saved data from sessionStorage
            const savedData = JSON.parse(sessionStorage.getItem('formData'));
            if (savedData) {
                Object.keys(savedData).forEach(key => {
                    const element = document.getElementsByName(key)[0];
                    if (element) element.value = savedData[key];
                });
            }

            // Save form data to sessionStorage on input
            form.addEventListener('input', function(e) {
                const formData = {};
                const inputs = form.querySelectorAll('input, textarea');
                inputs.forEach(input => {
                    formData[input.name] = input.value;
                });
                sessionStorage.setItem('formData', JSON.stringify(formData));
            });

            // Clear sessionStorage on form submission
            form.addEventListener('submit', function(e) {
                e.preventDefault();
                alert('Form submitted!');
                sessionStorage.removeItem('formData');
            });
        });
    </script>
</body>
</html>