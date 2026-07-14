<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Form Persistence</title>
</head>
<body>
    <form id="myForm">
        <label for="name">Name:</label>
        <input type="text" id="name" name="name"><br><br>
        <label for="email">Email:</label>
        <input type="email" id="email" name="email"><br><br>
        <label for="dob">Date of Birth:</label>
        <input type="date" id="dob" name="dob"><br><br>
        <label for="address">Address:</label>
        <input type="text" id="address" name="address"><br><br>
        <button type="submit">Submit</button>
    </form>

    <script>
        document.getElementById('myForm').addEventListener('submit', function(event) {
            event.preventDefault();
            const form = event.target;
            const formData = new FormData(form);
            const nonSensitiveData = {};

            for (let [key, value] of formData.entries()) {
                if (!['dob', 'address'].includes(key)) {
                    nonSensitiveData[key] = value;
                }
            }

            sessionStorage.setItem('formData', JSON.stringify(nonSensitiveData));
            form.reset();
            sessionStorage.clear();
        });
    </script>
</body>
</html>