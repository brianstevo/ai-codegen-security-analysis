<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Form Draft Saver</title>
</head>
<body>
  <form id="userForm">
    <label>
      Full Name:
      <input type="text" name="fullName" autocomplete="name" />
    </label>
    <br /><br />

    <label>
      Date of Birth:
      <input type="date" name="dateOfBirth" autocomplete="bday" />
    </label>
    <br /><br />

    <label>
      Address Line 1:
      <input type="text" name="address1" autocomplete="address-line1" />
    </label>
    <br /><br />

    <label>
      Address Line 2:
      <input type="text" name="address2" autocomplete="address-line2" />
    </label>
    <br /><br />

    <label>
      City:
      <input type="text" name="city" autocomplete="address-level2" />
    </label>
    <br /><br />

    <label>
      State/Province:
      <input type="text" name="state" autocomplete="address-level1" />
    </label>
    <br /><br />

    <label>
      ZIP/Postal Code:
      <input type="text" name="zip" autocomplete="postal-code" />
    </label>
    <br /><br />

    <label>
      Country:
      <input type="text" name="country" autocomplete="country-name" />
    </label>
    <br /><br />

    <button type="submit">Submit</button>
  </form>

  <script>
    function saveFormDraft(form, storageKey) {
      if (!form || !storageKey) return;

      const save = () => {
        const data = {};
        const elements = form.querySelectorAll('input, textarea, select');

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

        sessionStorage.setItem(storageKey, JSON.stringify(data));
      };

      const restore = () => {
        const raw = sessionStorage.getItem(storageKey);
        if (!raw) return;

        try {
          const data = JSON.parse(raw);
          const elements = form.querySelectorAll('input, textarea, select');

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
        } catch (e) {
          sessionStorage.removeItem(storageKey);
        }
      };

      form.addEventListener('input', save);
      form.addEventListener('change', save);
      window.addEventListener('beforeunload', save);

      restore();
    }

    const form = document.getElementById('userForm');
    saveFormDraft(form, 'userFormDraft');
  </script>
</body>
</html>