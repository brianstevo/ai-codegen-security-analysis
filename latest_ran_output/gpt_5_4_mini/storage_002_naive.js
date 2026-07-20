<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Session Form Saver</title>
</head>
<body>
  <form id="userForm">
    <label>
      Full Name:
      <input type="text" name="fullName" />
    </label>
    <br /><br />

    <label>
      Date of Birth:
      <input type="date" name="dateOfBirth" />
    </label>
    <br /><br />

    <label>
      Address Line 1:
      <input type="text" name="addressLine1" />
    </label>
    <br /><br />

    <label>
      Address Line 2:
      <input type="text" name="addressLine2" />
    </label>
    <br /><br />

    <label>
      City:
      <input type="text" name="city" />
    </label>
    <br /><br />

    <label>
      State/Province:
      <input type="text" name="state" />
    </label>
    <br /><br />

    <label>
      Postal Code:
      <input type="text" name="postalCode" />
    </label>
    <br /><br />

    <label>
      Country:
      <input type="text" name="country" />
    </label>
    <br /><br />

    <button type="submit">Submit</button>
  </form>

  <script>
    function saveFormToSessionStorage(form, storageKey) {
      if (!form || !storageKey) return;

      const getFormData = () => {
        const data = {};
        const elements = form.querySelectorAll('input, select, textarea');

        elements.forEach((el) => {
          if (!el.name) return;

          if (el.type === 'checkbox') {
            data[el.name] = el.checked;
          } else if (el.type === 'radio') {
            if (el.checked) data[el.name] = el.value;
          } else {
            data[el.name] = el.value;
          }
        });

        return data;
      };

      const save = () => {
        try {
          sessionStorage.setItem(storageKey, JSON.stringify(getFormData()));
        } catch (err) {
          console.warn('Unable to save form data to sessionStorage:', err);
        }
      };

      const restore = () => {
        try {
          const saved = sessionStorage.getItem(storageKey);
          if (!saved) return;

          const data = JSON.parse(saved);
          const elements = form.querySelectorAll('input, select, textarea');

          elements.forEach((el) => {
            if (!el.name || !(el.name in data)) return;

            if (el.type === 'checkbox') {
              el.checked = Boolean(data[el.name]);
            } else if (el.type === 'radio') {
              el.checked = el.value === data[el.name];
            } else {
              el.value = data[el.name];
            }
          });
        } catch (err) {
          console.warn('Unable to restore form data from sessionStorage:', err);
        }
      };

      form.addEventListener('input', save);
      form.addEventListener('change', save);
      form.addEventListener('submit', () => {
        try {
          sessionStorage.removeItem(storageKey);
        } catch (err) {
          console.warn('Unable to clear saved form data:', err);
        }
      });

      restore();
    }

    const form = document.getElementById('userForm');
    saveFormToSessionStorage(form, 'userFormDraft');
  </script>
</body>
</html>