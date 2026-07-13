<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Multi‑Step Form with Persistent Non‑Sensitive Data</title>
<style>
  .step { display: none; }
  .step.active { display: block; }
</style>
</head>
<body>

<form id="multiStepForm">
  <!-- Step 1 -->
  <div class="step active" data-step="1">
    <h2>Step 1</h2>
    <label>
      First Name:
      <input type="text" name="firstName" required>
    </label><br>
    <label>
      Last Name:
      <input type="text" name="lastName" required>
    </label><br>
    <button type="button" id="toStep2">Next</button>
  </div>

  <!-- Step 2 -->
  <div class="step" data-step="2">
    <h2>Step 2 (Sensitive fields are not stored)</h2>
    <label>
      Date of Birth:
      <input type="date" name="dob" required>
    </label><br>
    <label>
      Address:
      <input type="text" name="address" required>
    </label><br>
    <label>
      Email:
      <input type="email" name="email" required>
    </label><br>
    <button type="button" id="toStep1">Back</button>
    <button type="submit">Submit</button>
  </div>
</form>

<script>
// ---------- Persistence Logic ----------
function initFormPersistence(formSelector, sensitiveFieldNames) {
  const form = document.querySelector(formSelector);
  if (!form) return;

  // Save non‑sensitive fields on change
  form.addEventListener('input', function (e) {
    const target = e.target;
    if (target.name && !sensitiveFieldNames.includes(target.name)) {
      sessionStorage.setItem(storageKey(target.name), target.value);
    }
  });

  // Populate fields from storage on load
  window.addEventListener('DOMContentLoaded', () => {
    const elements = form.querySelectorAll('[name]');
    elements.forEach(el => {
      if (!sensitiveFieldNames.includes(el.name)) {
        const saved = sessionStorage.getItem(storageKey(el.name));
        if (saved !== null) el.value = saved;
      }
    });
  });

  // Clear storage after successful submit
  form.addEventListener('submit', function (e) {
    e.preventDefault(); // replace with real submission logic

    // Simulate async submission (replace with fetch/ajax as needed)
    fakeSubmit(new FormData(form))
      .then(() => {
        sessionStorage.clear();
        alert('Form submitted successfully! All stored data cleared.');
        form.reset();
        showStep(1);
      })
      .catch(err => {
        console.error('Submission failed:', err);
        alert('Submission failed. Please try again.');
      });
  });

  function storageKey(fieldName) {
    // Unique key per form (using form id) + field name
    return `${form.id}_field_${fieldName}`;
  }
}

// ---------- Navigation Helpers ----------
function showStep(stepNumber) {
  document.querySelectorAll('.step').forEach(div => {
    div.classList.toggle('active', Number(div.dataset.step) === stepNumber);
  });
}

document.getElementById('toStep2').addEventListener('click', () => showStep(2));
document.getElementById('toStep1').addEventListener('click', () => showStep(1));

// ---------- Fake Submit (replace with real AJAX) ----------
function fakeSubmit(formData) {
  return new Promise((resolve) => setTimeout(resolve, 1000));
}

// ---------- Initialize Persistence ----------
initFormPersistence('#multiStepForm', ['dob', 'address']);
</script>

</body>
</html>