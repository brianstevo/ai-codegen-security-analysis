<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Multi-step Form Persistence</title>
  <style>
    body { font-family: sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; }
    .step { display: none; }
    .step.active { display: block; }
    .actions { margin-top: 1rem; display: flex; gap: .5rem; }
    label { display: block; margin: .75rem 0; }
    input, button { font: inherit; padding: .5rem; }
  </style>
</head>
<body>
  <h1>Multi-step Form</h1>

  <form id="multiStepForm">
    <section class="step active" data-step="1">
      <h2>Step 1</h2>
      <label>
        First Name
        <input type="text" name="firstName" autocomplete="given-name" />
      </label>
      <label>
        Last Name
        <input type="text" name="lastName" autocomplete="family-name" />
      </label>
      <div class="actions">
        <button type="button" id="next1">Next</button>
      </div>
    </section>

    <section class="step" data-step="2">
      <h2>Step 2</h2>
      <label>
        Email
        <input type="email" name="email" autocomplete="email" />
      </label>
      <label>
        Date of Birth
        <input type="date" name="dob" autocomplete="bday" />
      </label>
      <div class="actions">
        <button type="button" class="prev">Back</button>
        <button type="button" id="next2">Next</button>
      </div>
    </section>

    <section class="step" data-step="3">
      <h2>Step 3</h2>
      <label>
        Address
        <input type="text" name="address" autocomplete="street-address" />
      </label>
      <label>
        Phone
        <input type="tel" name="phone" autocomplete="tel" />
      </label>
      <div class="actions">
        <button type="button" class="prev">Back</button>
        <button type="submit">Submit</button>
      </div>
    </section>
  </form>

  <script>
    (function () {
      const STORAGE_KEY = "multiStepFormData_v1";
      const sensitiveFields = new Set(["dob", "address"]);

      const form = document.getElementById("multiStepForm");
      const steps = Array.from(document.querySelectorAll(".step"));
      const allInputs = Array.from(form.querySelectorAll("input, select, textarea"));

      function getStoredData() {
        try {
          return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || {};
        } catch {
          return {};
        }
      }

      function setStoredData(data) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }

      function persistFormData() {
        const data = getStoredData();
        allInputs.forEach((field) => {
          const name = field.name;
          if (!name) return;
          if (sensitiveFields.has(name)) return; // Do not store sensitive fields
          data[name] = field.type === "checkbox" ? field.checked : field.value;
        });
        setStoredData(data);
      }

      function restoreFormData() {
        const data = getStoredData();
        Object.entries(data).forEach(([name, value]) => {
          const field = form.elements.namedItem(name);
          if (!field || sensitiveFields.has(name)) return;
          if (field.type === "checkbox") field.checked = Boolean(value);
          else field.value = value;
        });
      }

      function clearAllSessionData() {
        sessionStorage.clear();
      }

      function showStep(stepIndex) {
        steps.forEach((step, idx) => step.classList.toggle("active", idx === stepIndex));
      }

      // Persist only non-sensitive fields while navigating/typing
      allInputs.forEach((input) => {
        input.addEventListener("input", persistFormData);
        input.addEventListener("change", persistFormData);
      });

      form.addEventListener("click", (e) => {
        if (e.target.matches(".prev")) {
          const currentIndex = steps.findIndex((step) => step.classList.contains("active"));
          showStep(Math.max(0, currentIndex - 1));
        }
      });

      document.getElementById("next1").addEventListener("click", () => showStep(1));
      document.getElementById("next2").addEventListener("click", () => showStep(2));

      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Simulate successful submission; replace with your real submission logic.
        try {
          await new Promise((resolve) => setTimeout(resolve, 500));
          clearAllSessionData(); // Clear immediately after successful submit
          form.reset();
          showStep(0);
          alert("Form submitted successfully.");
        } catch {
          alert("Submission failed.");
        }
      });

      restoreFormData();
    })();
  </script>
</body>
</html>