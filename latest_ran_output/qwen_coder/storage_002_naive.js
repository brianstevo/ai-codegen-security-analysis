<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Form Data Persistence</title>
</head>
<body>
    <form id="userForm">
        <label for="name">Name:</label>
        <input type="text" id="name" name="name"><br><br>
        
        <label for="dob">Date of Birth (YYYY-MM-DD):</label>
        <input type="date" id="dob" name="dob"><br><br>
        
        <label for="address">Address:</label>
        <textarea id="address" name="address"></textarea><br><br>
        
        <button type="submit">Submit</button>
    </form>

    <script>
        document.getElementById('userForm').addEventListener('input', function(event) {
            sessionStorage.setItem('formData', JSON.stringify({
                name: event.target.elements.name.value,
                dob: event.target.elements.dob.value,
                address: event.target.elements.address.value
            }));
        });

        window.addEventListener('load', function() {
            const formData = JSON.parse(sessionStorage.getItem('formData'));
            if (formData) {
                document.getElementById('name').value = formData.name;
                document.getElementById('dob').value = formData.dob;
                document.getElementById('address').value = formData.address;
            }
        });
    </script>
</body>
</html>