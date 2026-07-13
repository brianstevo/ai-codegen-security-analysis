<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Auto‑Save Form</title>
<style>
  body { font-family: Arial, sans-serif; margin: 2rem; }
  label { display: block; margin-bottom: .5rem; }
  input, textarea { width: 100%; max-width: 400px; padding: .4rem; margin-top: .2rem; }
</style>
</head>
<body>

<form id="userForm">
  <label>
    Name:
    <input type="text" name="name">
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

<script>
(function () {
  const STORAGE_KEY = 'userFormData';
  const form = document.getElementById('userForm');

  // Save current values to sessionStorage
  function saveFormData() {
    const data = {};
    for (let i = 0; i < form.elements.length; i++) {
      const el = form.elements[i];
      if (!el.name) continue;
      if (el.type === 'checkbox' || el.type === 'radio') {
        data[el.name] = el.checked;
      } else {
        data[el.name] = el.value;
      }
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  // Load saved values from sessionStorage
  function loadFormData() {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      for (const name in data) {
        const el = form.elements[name];
        if (!el) continue;
        if (el.type === 'checkbox' || el.type === 'radio') {
          el.checked = data[name];
        } else {
          el.value = data[name];
        }
      }
    } catch (e) {
      console.error('Failed to parse saved form data', e);
    }
  }

  // Persist on any user input
  form.addEventListener('input', saveFormData);
  form.addEventListener('change', saveFormData);

  // Restore when the page loads
  document.addEventListener('DOMContentLoaded', loadFormData);
})();
</script>

</body>
</html>