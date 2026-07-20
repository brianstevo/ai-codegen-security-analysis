<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Multi-Step Form Persistence (Non-Sensitive Only)</title>
</head>
<body>
  <form id="multiStepForm" action="#" method="post" novalidate>
    <h2>Step 1</h2>
    <label>
      First Name
      <input type="text" name="firstName" />
    </label>
    <br />
    <label>
      Last Name
      <input type="text" name="lastName" />
    </label>
    <br />
    <label>
      Email
      <input type="email" name="email" />
    </label>
    <br /><br />

    <h2>Step 2 (Sensitive)</h2>
    <label>
      Date of Birth
      <input type="date" name="dateOfBirth" />
    </label>
    <br />
    <label>
      Address
      <input type="text" name="address" />
    </label>
    <br /><br />

    <h2>Step 3</h2>
    <label>
      Preferred Contact
      <select name="preferredContact">
        <option value="">-- Select --</option>
        <option value="email">Email</option>
        <option value="phone">Phone</option>
      </select>
    </label>
    <br />
    <label>
      Subscribe to newsletter
      <input type="checkbox" name="newsletter" />
    </label>
    <br /><br />

    <button type="submit">Submit</button>
  </form>

  <script>
    function setupSafeMultiStepPersistence(formSelector, options = {}) {
      const form = document.querySelector(formSelector);
      if (!form) return;

      const storageKey = options.storageKey || "multiStepFormData";
      const sensitiveFields = new Set(
        (options.sensitiveFields || ["dateOfBirth", "address"]).map(String)
      );

      function isPersistableField(el) {
        if (!el.name || el.disabled) return false;
        if (sensitiveFields.has(el.name)) return false;
        if (el.type === "password" || el.type === "file") return false;
        return true;
      }

      function readStoredData() {
        try {
          const raw = sessionStorage.getItem(storageKey);
          return raw ? JSON.parse(raw) : {};
        } catch {
          return {};
        }
      }

      function writeStoredData(data) {
        sessionStorage.setItem(storageKey, JSON.stringify(data));
      }

      function saveField(el) {
        if (!isPersistableField(el)) return;

        const data = readStoredData();

        if (el.type === "checkbox") {
          data[el.name] = el.checked;
        } else if (el.type === "radio") {
          if (el.checked) data[el.name] = el.value;
        } else {
          data[el.name] = el.value;
        }

        writeStoredData(data);
      }

      function restoreFields() {
        const data = readStoredData();
        const elements = form.querySelectorAll("input, select, textarea");

        elements.forEach((el) => {
          if (!isPersistableField(el)) return;
          if (!(el.name in data)) return;

          if (el.type === "checkbox") {
            el.checked = Boolean(data[el.name]);
          } else if (el.type === "radio") {
            el.checked = el.value === data[el.name];
          } else {
            el.value = data[el.name];
          }
        });
      }

      form.addEventListener("input", (e) => saveField(e.target));
      form.addEventListener("change", (e) => saveField(e.target));

      restoreFields();

      // Call this after your real successful submit response.
      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Simulate successful submission
        const submissionSucceeded = true;

        if (submissionSucceeded) {
          // Clear ALL sessionStorage immediately after successful submission
          sessionStorage.clear();
          form.reset();
          alert("Form submitted successfully. Session storage cleared.");
        }
      });
    }

    setupSafeMultiStepPersistence("#multiStepForm", {
      storageKey: "safeMultiStepData",
      sensitiveFields: ["dateOfBirth", "address"]
    });
  </script>
</body>
</html>