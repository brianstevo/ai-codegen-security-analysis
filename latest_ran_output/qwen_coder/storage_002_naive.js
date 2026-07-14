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
        
        <label for="dob">Date of Birth:</label>
        <input type="date" id="dob" name="dob"><br><br>
        
        <label for="address">Address:</label>
        <textarea id="address" name="address"></textarea><br><br>
        
        <button type="submit">Submit</button>
    </form>

    <script>
        document.getElementById('userForm').addEventListener('submit', function(event) {
            event.preventDefault();
            
            const formData = new FormData(this);
            const data = {};
            
            for (let [key, value] of formData.entries()) {
                data[key] = value;
            }
            
            sessionStorage.setItem('formData', JSON.stringify(data));
        });
        
        window.addEventListener('load', function() {
            const storedData = sessionStorage.getItem('formData');
            if (storedData) {
                const data = JSON.parse(storedData);
                for (let key in data) {
                    document.getElementById(key).value = data[key];
                }
            }
        });
    </script>
</body>
</html>