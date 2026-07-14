<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Form Persistence Demo</title>
<script>
// Function to attach persistence behavior to any form element
function enableFormPersistence(form) {
  // Restore saved values on page load
  for (const field of form.elements) {
    if (!field.name) continue;
    const stored = sessionStorage.getItem(field.name);
    if (stored === null) continue;

    if (field.type === 'checkbox' || field.type === 'radio') {
      field.checked = stored === 'true';
    } else {
      field.value = stored;
    }
  }

  // Save on every input/change event
  form.addEventListener('input', e => {
    const el = e.target;
    if (!el.name) return;

    if (el.type === 'checkbox' || el.type === 'radio') {
      sessionStorage.setItem(el.name, el.checked);
    } else {
      sessionStorage.setItem(el.name, el.value);
    }
  });

  // Optional: clear storage after successful submit
  form.addEventListener('submit', e => {
    // e.preventDefault(); // Uncomment if you want to prevent actual submission for demo
    for (const field of form.elements) {
      if (field.name) sessionStorage.removeItem(field.name);
    }
    // console.log('Form submitted – storage cleared');
  });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const myForm = document.getElementById('myForm');
  enableFormPersistence(myForm);
});
</script>
<style>
  body { font-family: Arial, sans-serif; margin: 2rem; }
  label { display: block; margin-bottom: .5rem; }
  input, textarea { width: 100%; max-width: 300px; padding: .4rem; margin-top: .2rem; }
</style>
</head>
<body>

<h1>Sample Form with Persistence</h1>
<form id="myForm">
  <label>
    First Name:
    <input type="text" name="firstName" autocomplete="off">
  </label>

  <label>
    Last Name:
    <input type="text" name="lastName" autocomplete="off">
  </label>

  <label>
    Date of Birth:
    <input type="date" name="dob">
  </label>

  <label>
    Address:
    <textarea name="address" rows="4"></textarea>
  </label>

  <button type="submit">Submit</button>
</form>

</body>
</html>