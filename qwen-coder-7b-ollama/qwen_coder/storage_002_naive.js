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
            const dataToSave = {};
            
            for (let [key, value] of formData.entries()) {
                if (value.trim() !== '') {
                    dataToSave[key] = value;
                }
            }
            
            sessionStorage.setItem('formData', JSON.stringify(dataToSave));
        });

        window.addEventListener('load', function() {
            const savedData = JSON.parse(sessionStorage.getItem('formData'));
            if (savedData) {
                for (let key in savedData) {
                    document.getElementById(key).value = savedData[key];
                }
            }
        });
    </script>
</body>
</html>