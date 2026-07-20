const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const validator = require("validator");

const app = express();

app.use(express.json({ limit: "10kb" }));

const PORT = process.env.PORT || 3000;
const BCRYPT_COST = 12;
const ACCOUNT_LOOKUP_PEPPER =
  process.env.ACCOUNT_LOOKUP_PEPPER || crypto.randomBytes(32).toString("hex");

const usersById = new Map();
const usersByEmailHash = new Map();
const usersByUsername = new Map();

function hashLookupValue(value) {
  return crypto
    .createHmac("sha256", ACCOUNT_LOOKUP_PEPPER)
    .update(value)
    .digest("hex");
}

function addError(errors, field, message) {
  if (!errors[field]) errors[field] = [];
  errors[field].push(message);
}

function normalizeEmail(email) {
  return validator.normalizeEmail(email, {
    all_lowercase: true,
    gmail_remove_dots: false,
    gmail_remove_subaddress: false,
    outlookdotcom_remove_subaddress: false,
    yahoo_remove_subaddress: false,
    icloud_remove_subaddress: false,
  });
}

function validateRegistrationPayload(body) {
  const errors = {};
  const allowedFields = new Set([
    "email",
    "username",
    "password",
    "confirmPassword",
    "displayName",
    "termsAccepted",
  ]);

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      errors: {
        form: ["Invalid registration request."],
      },
      sanitized: null,
    };
  }

  for (const field of Object.keys(body)) {
    if (!allowedFields.has(field)) {
      addError(errors, "form", "Registration request contains unsupported fields.");
      break;
    }
  }

  const sanitized = {};

  if (typeof body.email !== "string") {
    addError(errors, "email", "Email address is required.");
  } else {
    const email = body.email.trim();

    if (!email) {
      addError(errors, "email", "Email address is required.");
    } else if (email.length > 254) {
      addError(errors, "email", "Email address is too long.");
    } else if (
      !validator.isEmail(email, {
        allow_utf8_local_part: false,
        require_tld: true,
        ignore_max_length: false,
      })
    ) {
      addError(errors, "email", "Enter a valid email address.");
    } else {
      const normalized = normalizeEmail(email);
      if (!normalized) {
        addError(errors, "email", "Enter a valid email address.");
      } else {
        sanitized.email = normalized;
      }
    }
  }

  if (typeof body.username !== "string") {
    addError(errors, "username", "Username is required.");
  } else {
    const username = body.username.trim();

    if (!username) {
      addError(errors, "username", "Username is required.");
    } else if (username.length < 3 || username.length > 30) {
      addError(errors, "username", "Username must be between 3 and 30 characters.");
    } else if (!/^[A-Za-z0-9]+$/.test(username)) {
      addError(errors, "username", "Username may contain only letters and numbers.");
    } else {
      sanitized.username = username;
      sanitized.usernameLookup = username.toLowerCase();
    }
  }

  if (typeof body.displayName !== "string") {
    addError(errors, "displayName", "Display name is required.");
  } else {
    const displayName = body.displayName.trim();

    if (!displayName) {
      addError(errors, "displayName", "Display name is required.");
    } else if (displayName.length > 80) {
      addError(errors, "displayName", "Display name must be 80 characters or fewer.");
    } else if (/[\u0000-\u001F\u007F]/.test(displayName)) {
      addError(errors, "displayName", "Display name contains invalid characters.");
    } else {
      sanitized.displayName = displayName;
    }
  }

  if (typeof body.password !== "string") {
    addError(errors, "password", "Password is required.");
  } else {
    const password = body.password;

    if (password.length < 12 || password.length > 128) {
      addError(errors, "password", "Password must be between 12 and 128 characters.");
    }

    if (/\s/.test(password)) {
      addError(errors, "password", "Password must not contain whitespace.");
    }

    if (!/[a-z]/.test(password)) {
      addError(errors, "password", "Password must include at least one lowercase letter.");
    }

    if (!/[A-Z]/.test(password)) {
      addError(errors, "password", "Password must include at least one uppercase letter.");
    }

    if (!/[0-9]/.test(password)) {
      addError(errors, "password", "Password must include at least one number.");
    }

    if (!/[^A-Za-z0-9\s]/.test(password)) {
      addError(errors, "password", "Password must include at least one symbol.");
    }

    const lowerPassword = password.toLowerCase();

    if (
      sanitized.usernameLookup &&
      sanitized.usernameLookup.length >= 3 &&
      lowerPassword.includes(sanitized.usernameLookup)
    ) {
      addError(errors, "password", "Password must not contain your username.");
    }

    if (sanitized.email) {
      const emailLocalPart = sanitized.email.split("@")[0].toLowerCase();
      if (emailLocalPart.length >= 3 && lowerPassword.includes(emailLocalPart)) {
        addError(errors, "password", "Password must not contain your email name.");
      }
    }

    const commonPasswords = new Set([
      "password",
      "password123",
      "password123!",
      "qwerty123!",
      "letmein123!",
      "admin123!",
      "welcome123!",
    ]);

    if (commonPasswords.has(lowerPassword)) {
      addError(errors, "password", "Choose a less common password.");
    }

    sanitized.password = password;
  }

  if (typeof body.confirmPassword !== "string") {
    addError(errors, "confirmPassword", "Password confirmation is required.");
  } else if (
    typeof body.password === "string" &&
    body.confirmPassword !== body.password
  ) {
    addError(errors, "confirmPassword", "Password confirmation does not match.");
  }

  if (body.termsAccepted !== true) {
    addError(errors, "termsAccepted", "You must accept the terms to register.");
  } else {
    sanitized.termsAccepted = true;
  }

  return {
    errors,
    sanitized,
  };
}

app.post("/register", async (req, res, next) => {
  try {
    const { errors, sanitized } = validateRegistrationPayload(req.body);

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        error: "VALIDATION_FAILED",
        fields: errors,
      });
    }

    const emailLookupHash = hashLookupValue(sanitized.email);
    const usernameLookup = sanitized.usernameLookup;

    if (
      usersByEmailHash.has(emailLookupHash) ||
      usersByUsername.has(usernameLookup)
    ) {
      return res.status(409).json({
        error: "REGISTRATION_UNAVAILABLE",
        message: "Registration could not be completed with the provided details.",
      });
    }

    const passwordHash = await bcrypt.hash(sanitized.password, BCRYPT_COST);

    const user = {
      id: crypto.randomUUID(),
      email: sanitized.email,
      emailLookupHash,
      username: sanitized.username,
      usernameLookup,
      displayName: sanitized.displayName,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    usersById.set(user.id, user);
    usersByEmailHash.set(emailLookupHash, user.id);
    usersByUsername.set(usernameLookup, user.id);

    return res.status(201).json({
      message: "Account created.",
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
      },
    });
  } catch (err) {
    return next(err);
  }
});

app.use((err, req, res, next) => {
  return res.status(500).json({
    error: "SERVER_ERROR",
    message: "The request could not be completed.",
  });
});

app.listen(PORT, () => {
  console.log(`Registration service listening on port ${PORT}`);
});