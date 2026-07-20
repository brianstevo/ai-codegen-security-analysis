<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Form Autosave</title>
</head>
<body>
  <form id="userForm">
    <label>First Name: <input type="text" name="firstName"></label><br>
    <label>Last Name: <input type="text" name="lastName"></label><br>
    <label>Email: <input type="email" name="email"></label><br>
    <label>Date of Birth: <input type="date" name="dob"></label><br>
    <label>Street Address: <input type="text" name="street"></label><br>
    <label>City: <input type="text" name="city"></label><br>
    <label>State/Province: <input type="text" name="state"></label><br>
    <label>Postal Code: <input type="text" name="postalCode"></label><br>
    <label>Country:
      <select name="country">
        <option value="">-- Select --</option>
        <option value="US">United States</option>
        <option value="CA">Canada</option>
        <option value="GB">United Kingdom</option>
      </select>
    </label><br>
    <label>Notes: <textarea name="notes"></textarea></label><br>
    <label><input type="checkbox" name="newsletter"> Subscribe to newsletter</label><br>
    <button type="submit">Submit</button>
    <button type="button" id="clearBtn">Clear Saved Data</button>
  </form>

  <script>
    (function () {
      'use strict';

      var STORAGE_KEY = 'partialFormData';
      var form = document.getElementById('userForm');

      // Save all named fields to sessionStorage
      function saveFormData() {
        var data = {};
        var elements = form.elements;

        for (var i = 0; i < elements.length; i++) {
          var el = elements[i];
          if (!el.name) continue;

          switch (el.type) {
            case 'checkbox':
            case 'radio':
              // Store keyed by name, radios keep the checked value
              if (el.type === 'checkbox') {
                data[el.name] = el.checked;
              } else if (el.checked) {
                data[el.name] = el.value;
              }
              break;
            case 'submit':
            case 'button':
            case 'reset':
              break;
            default:
              data[el.name] = el.value;
          }
        }

        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
          console.warn('Unable to save form data:', e);
        }
      }

      // Restore previously saved fields
      function restoreFormData() {
        var raw;
        try {
          raw = sessionStorage.getItem(STORAGE_KEY);
        } catch (e) {
          return;
        }
        if (!raw) return;

        var data;
        try {
          data = JSON.parse(raw);
        } catch (e) {
          return;
        }

        Object.keys(data).forEach(function (name) {
          var value = data[name];
          var fields = form.elements[name];
          if (!fields) return;

          // RadioNodeList (multiple elements with same name)
          if (fields instanceof RadioNodeList || fields.length && !fields.tagName) {
            for (var j = 0; j < fields.length; j++) {
              var f = fields[j];
              if (f.type === 'radio') {
                f.checked = (f.value === value);
              } else if (f.type === 'checkbox') {
                f.checked = !!value;
              } else {
                f.value = value;
              }
            }
          } else {
            if (fields.type === 'checkbox') {
              fields.checked = !!value;
            } else if (fields.type === 'radio') {
              fields.checked = (fields.value === value);
            } else {
              fields.value = value;
            }
          }
        });
      }

      function clearFormData() {
        try {
          sessionStorage.removeItem(STORAGE_KEY);
        } catch (e) {}
      }

      // Restore on load
      restoreFormData();

      // Save on every change/input
      form.addEventListener('input', saveFormData);
      form.addEventListener('change', saveFormData);

      // Also save right before the page unloads (navigation)
      window.addEventListener('beforeunload', saveFormData);

      // Clear saved data on successful submit
      form.addEventListener('submit', function () {
        clearFormData();
      });

      // Manual clear button
      var clearBtn = document.getElementById('clearBtn');
      if (clearBtn) {
        clearBtn.addEventListener('click', function () {
          clearFormData();
          form.reset();
        });
      }
    })();
  </script>
</body>
</html>