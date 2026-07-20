(function () {
  "use strict";

  function persistMultiStepFormData(formOrSelector, options) {
    const form =
      typeof formOrSelector === "string"
        ? document.querySelector(formOrSelector)
        : formOrSelector;

    if (!(form instanceof HTMLFormElement)) {
      throw new Error("persistMultiStepFormData requires a form element or form selector.");
    }

    const settings = Object.assign(
      {
        storageKey:
          form.getAttribute("data-storage-key") ||
          form.id ||
          form.name ||
          "multiStepFormData",

        /*
          Strongly recommended:
          Pass every field name that is safe to persist.

          Example:
          persistMultiStepFormData("#myForm", {
            nonSensitiveFields: ["firstName", "lastName", "email", "currentStep"]
          });
        */
        nonSensitiveFields: null,

        /*
          These are never stored, even if included in nonSensitiveFields.
          Add app-specific sensitive field names here if needed.
        */
        sensitiveFields: [
          "dob",
          "dateOfBirth",
          "birthDate",
          "birthday",
          "bday",
          "address",
          "street",
          "streetAddress",
          "addressLine1",
          "addressLine2",
          "city",
          "state",
          "province",
          "zip",
          "zipcode",
          "postalCode",
          "postcode"
        ],

        /*
          Final submit is handled with fetch so success can be verified.
          sessionStorage.clear() runs only after a successful response.
        */
        submitWithFetch: true,
        credentials: "same-origin",
        headers: null,

        isSuccessfulSubmit: function (response) {
          return response.ok;
        },

        onSuccess: null,
        onError: null
      },
      options || {}
    );

    const allowedFieldNames = Array.isArray(settings.nonSensitiveFields)
      ? new Set(settings.nonSensitiveFields.map(String))
      : null;

    const sensitiveFieldNames = new Set(
      settings.sensitiveFields.map(function (name) {
        return normalize(name);
      })
    );

    const skippedInputTypes = new Set([
      "password",
      "file",
      "hidden",
      "submit",
      "button",
      "reset",
      "image"
    ]);

    const sensitiveAutocompleteTokens = new Set([
      "bday",
      "bday-day",
      "bday-month",
      "bday-year",
      "street-address",
      "address-line1",
      "address-line2",
      "address-line3",
      "address-level1",
      "address-level2",
      "address-level3",
      "address-level4",
      "country",
      "country-name",
      "postal-code"
    ]);

    const dobPattern = /(dateofbirth|birthdate|birthday|bday|dob)/i;

    const physicalAddressPattern =
      /(streetaddress|addressline\d*|homeaddress|mailingaddress|postaladdress|physicaladdress|shippingaddress|billingaddress|address|street|city|zipcode|postalcode|postcode|zip|province|state|county|country)/i;

    let saveTimer = null;
    let lastSubmitter = null;

    function normalize(value) {
      return String(value || "")
        .toLowerCase()
        .replace(/[\s_.\-[\]]+/g, "");
    }

    function safeSessionGet(key) {
      try {
        return sessionStorage.getItem(key);
      } catch (_) {
        return null;
      }
    }

    function safeSessionSet(key, value) {
      try {
        sessionStorage.setItem(key, value);
      } catch (_) {}
    }

    function safeSessionClearAll() {
      try {
        sessionStorage.clear();
      } catch (_) {}
    }

    function parseStoredData() {
      const raw = safeSessionGet(settings.storageKey);

      if (!raw) {
        return {};
      }

      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? sanitizeRecord(parsed)
          : {};
      } catch (_) {
        return {};
      }
    }

    function isSensitiveName(nameOrText) {
      const normalized = normalize(nameOrText);

      if (!normalized) {
        return false;
      }

      if (sensitiveFieldNames.has(normalized)) {
        return true;
      }

      if (dobPattern.test(normalized)) {
        return true;
      }

      if (/email/.test(normalized)) {
        return false;
      }

      return physicalAddressPattern.test(normalized);
    }

    function isSensitiveControl(control) {
      if (control.matches("[data-sensitive='true'], [data-no-persist]")) {
        return true;
      }

      const type = String(control.type || "").toLowerCase();

      if (skippedInputTypes.has(type)) {
        return true;
      }

      const autocomplete = String(control.getAttribute("autocomplete") || "")
        .toLowerCase()
        .trim();

      if (sensitiveAutocompleteTokens.has(autocomplete)) {
        return true;
      }

      const isEmailField =
        type === "email" ||
        autocomplete === "email" ||
        /\bemail\b/i.test(control.name || "");

      const combinedText = [
        control.name,
        control.id,
        autocomplete,
        control.getAttribute("aria-label"),
        control.getAttribute("placeholder")
      ].join(" ");

      const normalizedText = normalize(combinedText);

      if (dobPattern.test(normalizedText)) {
        return true;
      }

      if (!isEmailField && physicalAddressPattern.test(normalizedText)) {
        return true;
      }

      return false;
    }

    function isPersistableControl(control) {
      if (!control.name || control.disabled) {
        return false;
      }

      if (control.dataset.persist === "false") {
        return false;
      }

      if (allowedFieldNames && !allowedFieldNames.has(control.name)) {
        return false;
      }

      if (isSensitiveControl(control)) {
        return false;
      }

      return true;
    }

    function getControls() {
      return Array.prototype.slice.call(
        form.querySelectorAll("input[name], select[name], textarea[name]")
      );
    }

    function getPersistableControlGroups() {
      const groups = new Map();

      getControls().forEach(function (control) {
        if (!isPersistableControl(control)) {
          return;
        }

        if (!groups.has(control.name)) {
          groups.set(control.name, []);
        }

        groups.get(control.name).push(control);
      });

      return groups;
    }

    function readControlGroup(controls) {
      const first = controls[0];
      const type = String(first.type || "").toLowerCase();

      if (type === "radio") {
        const checked = controls.find(function (control) {
          return control.checked;
        });

        return checked ? checked.value : "";
      }

      if (type === "checkbox") {
        if (controls.length === 1) {
          return first.checked;
        }

        return controls
          .filter(function (control) {
            return control.checked;
          })
          .map(function (control) {
            return control.value;
          });
      }

      if (first.tagName === "SELECT" && first.multiple) {
        return Array.prototype.slice
          .call(first.selectedOptions)
          .map(function (option) {
            return option.value;
          });
      }

      return first.value;
    }

    function writeControlGroup(controls, value) {
      const first = controls[0];
      const type = String(first.type || "").toLowerCase();

      if (type === "radio") {
        controls.forEach(function (control) {
          control.checked = String(control.value) === String(value);
        });
        return;
      }

      if (type === "checkbox") {
        if (controls.length === 1 && typeof value === "boolean") {
          first.checked = value;
          return;
        }

        const selectedValues = Array.isArray(value)
          ? value.map(String)
          : [String(value)];

        controls.forEach(function (control) {
          control.checked = selectedValues.indexOf(String(control.value)) !== -1;
        });

        return;
      }

      if (first.tagName === "SELECT" && first.multiple) {
        const selectedValues = Array.isArray(value)
          ? value.map(String)
          : [String(value)];

        Array.prototype.slice.call(first.options).forEach(function (option) {
          option.selected = selectedValues.indexOf(String(option.value)) !== -1;
        });

        return;
      }

      first.value = value == null ? "" : String(value);
    }

    function sanitizeRecord(record) {
      const sanitized = {};

      Object.keys(record).forEach(function (fieldName) {
        if (allowedFieldNames && !allowedFieldNames.has(fieldName)) {
          return;
        }

        if (isSensitiveName(fieldName)) {
          return;
        }

        sanitized[fieldName] = record[fieldName];
      });

      return sanitized;
    }

    function save() {
      const existingData = parseStoredData();
      const nextData = Object.assign({}, existingData);
      const groups = getPersistableControlGroups();

      groups.forEach(function (controls, fieldName) {
        nextData[fieldName] = readControlGroup(controls);
      });

      safeSessionSet(settings.storageKey, JSON.stringify(sanitizeRecord(nextData)));
    }

    function scheduleSave() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(save, 100);
    }

    function restore() {
      const storedData = parseStoredData();
      const groups = getPersistableControlGroups();

      groups.forEach(function (controls, fieldName) {
        if (Object.prototype.hasOwnProperty.call(storedData, fieldName)) {
          writeControlGroup(controls, storedData[fieldName]);
        }
      });
    }

    function buildFormData(submitter) {
      try {
        return submitter ? new FormData(form, submitter) : new FormData(form);
      } catch (_) {
        const formData = new FormData(form);

        if (submitter && submitter.name && !submitter.disabled) {
          formData.append(submitter.name, submitter.value);
        }

        return formData;
      }
    }

    function formDataToTextPlain(formData) {
      const lines = [];

      formData.forEach(function (value, key) {
        lines.push(key + "=" + value);
      });

      return lines.join("\r\n");
    }

    async function submitFormWithFetch(submitter) {
      const method = String(form.getAttribute("method") || "GET").toUpperCase();
      const action = form.getAttribute("action") || window.location.href;
      const url = new URL(action, window.location.href);
      const formData = buildFormData(submitter);

      const requestInit = {
        method: method,
        credentials: settings.credentials
      };

      if (settings.headers) {
        requestInit.headers = settings.headers;
      }

      if (method === "GET" || method === "HEAD") {
        formData.forEach(function (value, key) {
          url.searchParams.append(key, value);
        });
      } else {
        const enctype = String(form.enctype || "").toLowerCase();

        if (enctype === "application/x-www-form-urlencoded") {
          requestInit.body = new URLSearchParams(formData);
        } else if (enctype === "text/plain") {
          requestInit.body = formDataToTextPlain(formData);
          requestInit.headers = Object.assign({}, requestInit.headers || {}, {
            "Content-Type": "text/plain;charset=UTF-8"
          });
        } else {
          requestInit.body = formData;
        }
      }

      return fetch(url.toString(), requestInit);
    }

    async function handleSubmit(event) {
      if (!settings.submitWithFetch) {
        return;
      }

      if (!form.checkValidity()) {
        return;
      }

      event.preventDefault();

      const submitter = event.submitter || lastSubmitter || null;

      try {
        const response = await submitFormWithFetch(submitter);
        const responseForCheck = response.clone();

        const successful = await settings.isSuccessfulSubmit(responseForCheck, form);

        if (successful) {
          safeSessionClearAll();

          form.dispatchEvent(
            new CustomEvent("multi-step-form:submit-success", {
              bubbles: true,
              detail: { response: response }
            })
          );

          if (typeof settings.onSuccess === "function") {
            settings.onSuccess(response, form);
          } else if (response.redirected && response.url) {
            window.location.assign(response.url);
          }
        } else {
          form.dispatchEvent(
            new CustomEvent("multi-step-form:submit-failed", {
              bubbles: true,
              detail: { response: response }
            })
          );
        }
      } catch (error) {
        if (typeof settings.onError === "function") {
          settings.onError(error, form);
        }

        form.dispatchEvent(
          new CustomEvent("multi-step-form:submit-error", {
            bubbles: true,
            detail: { error: error }
          })
        );
      }
    }

    function rememberSubmitter(event) {
      const target = event.target;

      if (
        target instanceof HTMLElement &&
        target.matches(
          "button[type='submit'], button:not([type]), input[type='submit'], input[type='image']"
        )
      ) {
        lastSubmitter = target;
      }
    }

    function destroy() {
      clearTimeout(saveTimer);
      form.removeEventListener("input", scheduleSave, true);
      form.removeEventListener("change", scheduleSave, true);
      form.removeEventListener("submit", handleSubmit);
      form.removeEventListener("click", rememberSubmitter, true);
      window.removeEventListener("pagehide", save);
    }

    restore();

    form.addEventListener("input", scheduleSave, true);
    form.addEventListener("change", scheduleSave, true);
    form.addEventListener("submit", handleSubmit);
    form.addEventListener("click", rememberSubmitter, true);
    window.addEventListener("pagehide", save);

    return {
      save: save,
      restore: restore,
      clearAllSessionStorage: safeSessionClearAll,
      destroy: destroy
    };
  }

  window.persistMultiStepFormData = persistMultiStepFormData;
})();