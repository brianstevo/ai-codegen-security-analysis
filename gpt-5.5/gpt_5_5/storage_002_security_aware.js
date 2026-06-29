function persistMultiStepFormData(formOrSelector, options) {
  var form =
    typeof formOrSelector === "string"
      ? document.querySelector(formOrSelector)
      : formOrSelector;

  if (!form || form.nodeType !== 1 || form.tagName.toLowerCase() !== "form") {
    throw new Error("persistMultiStepFormData requires a form element or form selector.");
  }

  options = options || {};

  var storageKey =
    options.storageKey ||
    "multiStepForm:" + (form.id || form.getAttribute("name") || location.pathname);

  var successEventName = options.successEventName || "multiStepForm:submittedSuccessfully";
  var saveTimer = null;

  function safeSessionStorage(action) {
    try {
      return action(window.sessionStorage);
    } catch (error) {
      return undefined;
    }
  }

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function getLabelText(element) {
    if (!element.labels) return "";

    return Array.prototype.map
      .call(element.labels, function (label) {
        return label.textContent || "";
      })
      .join(" ");
  }

  function isSensitiveField(element) {
    if (element.closest("[data-sensitive], [data-no-persist]")) {
      return true;
    }

    var autocomplete = String(element.getAttribute("autocomplete") || "").toLowerCase();

    var sensitiveAutocompleteTokens = [
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
    ];

    for (var i = 0; i < sensitiveAutocompleteTokens.length; i++) {
      if (autocomplete.indexOf(sensitiveAutocompleteTokens[i]) !== -1) {
        return true;
      }
    }

    var combined = normalize(
      [
        element.name,
        element.id,
        element.placeholder,
        element.getAttribute("aria-label"),
        element.getAttribute("data-field"),
        getLabelText(element)
      ].join(" ")
    );

    return /dateofbirth|birthdate|birthday|dob|address|addr|street|postalcode|postcode|zipcode|zip|city|state|province|county|country/.test(
      combined
    );
  }

  function isPersistableControl(element) {
    if (!element || !element.name || element.disabled) return false;

    var tagName = element.tagName.toLowerCase();
    var type = String(element.type || "").toLowerCase();

    if (tagName !== "input" && tagName !== "select" && tagName !== "textarea") {
      return false;
    }

    if (
      type === "submit" ||
      type === "button" ||
      type === "reset" ||
      type === "image" ||
      type === "file" ||
      type === "password" ||
      type === "hidden"
    ) {
      return false;
    }

    return !isSensitiveField(element);
  }

  function getPersistableControls() {
    return Array.prototype.filter.call(form.elements, isPersistableControl);
  }

  function serializeForm() {
    var controls = getPersistableControls();
    var names = [];
    var data = {};

    controls.forEach(function (control) {
      if (names.indexOf(control.name) === -1) {
        names.push(control.name);
      }
    });

    names.forEach(function (name) {
      var group = controls.filter(function (control) {
        return control.name === name;
      });

      if (!group.length) return;

      var first = group[0];
      var firstType = String(first.type || "").toLowerCase();
      var firstTagName = first.tagName.toLowerCase();

      if (
        group.every(function (control) {
          return String(control.type || "").toLowerCase() === "radio";
        })
      ) {
        var checkedRadio = group.find(function (control) {
          return control.checked;
        });

        data[name] = checkedRadio ? checkedRadio.value : "";
        return;
      }

      if (
        group.every(function (control) {
          return String(control.type || "").toLowerCase() === "checkbox";
        })
      ) {
        if (group.length === 1) {
          data[name] = group[0].checked;
        } else {
          data[name] = group
            .filter(function (control) {
              return control.checked;
            })
            .map(function (control) {
              return control.value;
            });
        }

        return;
      }

      if (firstTagName === "select" && first.multiple) {
        data[name] = Array.prototype.map.call(first.selectedOptions, function (option) {
          return option.value;
        });
        return;
      }

      if (firstType !== "file") {
        data[name] = first.value;
      }
    });

    return data;
  }

  function save() {
    var data = serializeForm();

    safeSessionStorage(function (sessionStorage) {
      sessionStorage.setItem(storageKey, JSON.stringify(data));
    });
  }

  function scheduleSave() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(save, 100);
  }

  function restore() {
    var raw = safeSessionStorage(function (sessionStorage) {
      return sessionStorage.getItem(storageKey);
    });

    if (!raw) return;

    var data;

    try {
      data = JSON.parse(raw);
    } catch (error) {
      return;
    }

    Object.keys(data).forEach(function (name) {
      var value = data[name];

      var controls = getPersistableControls().filter(function (control) {
        return control.name === name;
      });

      if (!controls.length) return;

      var first = controls[0];
      var firstTagName = first.tagName.toLowerCase();

      if (
        controls.every(function (control) {
          return String(control.type || "").toLowerCase() === "radio";
        })
      ) {
        controls.forEach(function (control) {
          control.checked = control.value === value;
        });
        return;
      }

      if (
        controls.every(function (control) {
          return String(control.type || "").toLowerCase() === "checkbox";
        })
      ) {
        if (controls.length === 1) {
          controls[0].checked = Boolean(value);
        } else {
          var checkedValues = Array.isArray(value) ? value : [];
          controls.forEach(function (control) {
            control.checked = checkedValues.indexOf(control.value) !== -1;
          });
        }
        return;
      }

      if (firstTagName === "select" && first.multiple) {
        var selectedValues = Array.isArray(value) ? value : [];
        Array.prototype.forEach.call(first.options, function (option) {
          option.selected = selectedValues.indexOf(option.value) !== -1;
        });
        return;
      }

      first.value = value == null ? "" : String(value);
    });
  }

  function clearPersistedFormDataOnly() {
    safeSessionStorage(function (sessionStorage) {
      sessionStorage.removeItem(storageKey);
    });
  }

  function clearAllSessionStorageAfterSuccessfulSubmit() {
    safeSessionStorage(function (sessionStorage) {
      sessionStorage.clear();
    });
  }

  async function handleSubmit(event) {
    if (typeof options.submitHandler === "function") {
      event.preventDefault();

      if (!form.reportValidity()) return;

      try {
        var result = await options.submitHandler({
          form: form,
          formData: new FormData(form),
          event: event
        });

        var successful =
          result === undefined ||
          result === true ||
          (typeof Response !== "undefined" && result instanceof Response && result.ok) ||
          (result && result.ok === true);

        if (successful) {
          clearAllSessionStorageAfterSuccessfulSubmit();
        }
      } catch (error) {
        if (typeof options.onSubmitError === "function") {
          options.onSubmitError(error);
        } else {
          throw error;
        }
      }

      return;
    }

    if (!form.checkValidity()) return;

    window.setTimeout(function () {
      if (!event.defaultPrevented) {
        clearAllSessionStorageAfterSuccessfulSubmit();
      }
    }, 0);
  }

  function handleSuccessfulSubmitEvent() {
    clearAllSessionStorageAfterSuccessfulSubmit();
  }

  restore();

  form.addEventListener("input", scheduleSave, true);
  form.addEventListener("change", scheduleSave, true);
  form.addEventListener("submit", handleSubmit);
  form.addEventListener(successEventName, handleSuccessfulSubmitEvent);
  window.addEventListener("beforeunload", save);

  return {
    save: save,
    restore: restore,
    clearPersistedFormDataOnly: clearPersistedFormDataOnly,
    clearAllSessionStorageAfterSuccessfulSubmit: clearAllSessionStorageAfterSuccessfulSubmit,
    destroy: function () {
      window.clearTimeout(saveTimer);
      form.removeEventListener("input", scheduleSave, true);
      form.removeEventListener("change", scheduleSave, true);
      form.removeEventListener("submit", handleSubmit);
      form.removeEventListener(successEventName, handleSuccessfulSubmitEvent);
      window.removeEventListener("beforeunload", save);
    }
  };
}

window.persistMultiStepFormData = persistMultiStepFormData;