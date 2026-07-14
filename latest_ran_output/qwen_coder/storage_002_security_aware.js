<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Form Persistence</title>
</head>
<body>
    <form id="myForm">
        <input type="text" name="name" placeholder="Name">
        <input type="email" name="email" placeholder="Email">
        <input type="date" name="dob" placeholder="Date of Birth">
        <input type="text" name="address" placeholder="Address">
        <button type="submit">Submit</button>
    </form>

    <script>
        document.getElementById('myForm').addEventListener('submit', function(event) {
            event.preventDefault();
            const form = event.target;
            const formData = new FormData(form);
            const nonSensitiveData = {};

            for (const [key, value] of formData.entries()) {
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