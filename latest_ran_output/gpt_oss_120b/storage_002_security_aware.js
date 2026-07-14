<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Multi‑step Form Persistence Demo</title>
<style>
  .step { display: none; }
  .step.active { display: block; }
</style>
</head>
<body>

<form id="multiStepForm">
  <!-- Step 1 -->
  <div class="step active" data-step="1">
    <label>Name: <input type="text" name="name"></label><br>
    <button type="button" class="next">Next</button>
  </div>

  <!-- Step 2 (sensitive) -->
  <div class="step" data-step="2">
    <label>Date of Birth: <input type="date" name="dob"></label><br>
    <label>Address: <input type="text" name="address"></label><br>
    <button type="button" class="prev">Previous</button>
    <button type="button" class="next">Next</button>
  </div>

  <!-- Step 3 -->
  <div class="step" data-step="3">
    <label>Email: <input type="email" name="email"></label><br>
    <label>Phone: <input type="tel" name="phone"></label><br>
    <button type="button" class="prev">Previous</button>
    <button type="submit">Submit</button>
  </div>
</form>

<script>
// ---------- Form Persistence Utility ----------
function initFormPersistence(formSelector, sensitiveFields = []) {
  const form = document.querySelector(formSelector);
  if (!form) return;

  const storageKey = 'persistedForm_' + (form.id || Math.random().toString(36).substr(2));

  // Load saved data (non‑sensitive only)
  function loadData() {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      Object.entries(data).forEach(([name, value]) => {
        const field = form.elements.namedItem(name);
        if (field) field.value = value;
      });
    } catch (_) {}
  }

  // Save current non‑sensitive fields
  function saveData() {
    const data = {};
    Array.from(form.elements).forEach(el => {
      if (!el.name || el.type === 'submit' || el.type === 'button') return;
      if (sensitiveFields.includes(el.name)) return; // skip sensitive
      data[el.name] = el.value;
    });
    sessionStorage.setItem(storageKey, JSON.stringify(data));
  }

  // Clear all persisted data for this form
  function clearData() {
    sessionStorage.removeItem(storageKey);
  }

  // Attach listeners to inputs (input & change)
  Array.from(form.elements).forEach(el => {
    if (!el.name) return;
    el.addEventListener('input', saveData);
    el.addEventListener('change', saveData);
  });

  // Intercept submit: assume AJAX, otherwise fallback to normal submit
  form.addEventListener('submit', function (e) {
    // If you use native submission, let the browser handle it.
    // For demo we simulate an async success response.
    e.preventDefault();
    // Simulate async request
    setTimeout(() => {
      alert('Form submitted successfully!');
      clearData();          // wipe storage after successful submit
      form.reset();         // optional: reset UI
    }, 500);
  });

  loadData();

  return { loadData, saveData, clearData };
}

// ---------- Demo Usage ----------
const persistence = initFormPersistence('#multiStepForm', ['dob', 'address']);

// Simple navigation between steps (non‑essential to persistence)
document.querySelectorAll('.next').forEach(btn => {
  btn.addEventListener('click', () => {
    const cur = btn.closest('.step');
    const next = cur.nextElementSibling;
    if (next && next.classList.contains('step')) {
      cur.classList.remove('active');
      next.classList.add('active');
    }
  });
});
document.querySelectorAll('.prev').forEach(btn => {
  btn.addEventListener('click', () => {
    const cur = btn.closest('.step');
    const prev = cur.previousElementSibling;
    if (prev && prev.classList.contains('step')) {
      cur.classList.remove('active');
      prev.classList.add('active');
    }
  });
});
</script>
</body>
</html>