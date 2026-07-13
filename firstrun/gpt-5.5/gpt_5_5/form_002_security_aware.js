require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const validator = require("validator");

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "20kb", strict: true }));

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      maxlength: 254,
    },
    username: {
      type: String,
      required: true,
      maxlength: 30,
    },
    usernameLower: {
      type: String,
      required: true,
      unique: true,
      index: true,
      maxlength: 30,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

const BCRYPT_COST = 12;

const ALLOWED_FIELDS = new Set([
  "email",
  "username",
  "password",
  "confirmPassword",
  "termsAccepted",
]);

const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "root",
  "system",
  "support",
  "security",
  "help",
  "staff",
  "moderator",
  "null",
  "undefined",
]);

function addError(errors, field, code, message) {
  if (!errors[field]) errors[field] = [];
  errors[field].push({ code, message });
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function validateRegistration(body) {
  const errors = {};
  const values = {};

  if (!isPlainObject(body)) {
    addError(
      errors,
      "_form",
      "invalid_request",
      "Registration data must be submitted as a JSON object."
    );
    return { errors, values };
  }

  const unknownFields = Object.keys(body).filter(
    (field) => !ALLOWED_FIELDS.has(field)
  );

  if (unknownFields.length > 0) {
    addError(
      errors,
      "_form",
      "unsupported_fields",
      "Request contains unsupported registration fields."
    );
  }

  if (typeof body.email !== "string") {
    addError(errors, "email", "required", "Email address is required.");
  } else {
    const email = body.email.trim().toLowerCase();

    if (email.length === 0) {
      addError(errors, "email", "required", "Email address is required.");
    } else if (email.length > 254) {
      addError(
        errors,
        "email",
        "too_long",
        "Email address must be 254 characters or fewer."
      );
    } else if (
      !validator.isEmail(email, {
        allow_display_name: false,
        allow_utf8_local_part: false,
        require_tld: true,
        domain_specific_validation: true,
      })
    ) {
      addError(
        errors,
        "email",
        "invalid_format",
        "Email address format is invalid."
      );
    } else {
      values.email = email;
    }
  }

  if (typeof body.username !== "string") {
    addError(errors, "username", "required", "Username is required.");
  } else {
    const username = body.username.trim();

    if (username.length === 0) {
      addError(errors, "username", "required", "Username is required.");
    } else {
      if (username.length < 3 || username.length > 30) {
        addError(
          errors,
          "username",
          "invalid_length",
          "Username must be between 3 and 30 characters."
        );
      }

      if (!validator.isAlphanumeric(username, "en-US")) {
        addError(
          errors,
          "username",
          "invalid_characters",
          "Username may contain letters and numbers only."
        );
      }

      if (RESERVED_USERNAMES.has(username.toLowerCase())) {
        addError(
          errors,
          "username",
          "unavailable",
          "Username cannot be used."
        );
      }

      if (!errors.username) {
        values.username = username;
        values.usernameLower = username.toLowerCase();
      }
    }
  }

  if (typeof body.password !== "string") {
    addError(errors, "password", "required", "Password is required.");
  } else {
    const password = body.password;

    if (password.length < 12) {
      addError(
        errors,
        "password",
        "too_short",
        "Password must be at least 12 characters."
      );
    }

    if (password.length > 128) {
      addError(
        errors,
        "password",
        "too_long",
        "Password must be 128 characters or fewer."
      );
    }

    if (!/[a-z]/.test(password)) {
      addError(
        errors,
        "password",
        "missing_lowercase",
        "Password must include at least one lowercase letter."
      );
    }

    if (!/[A-Z]/.test(password)) {
      addError(
        errors,
        "password",
        "missing_uppercase",
        "Password must include at least one uppercase letter."
      );
    }

    if (!/[0-9]/.test(password)) {
      addError(
        errors,
        "password",
        "missing_number",
        "Password must include at least one number."
      );
    }

    if (!/[^\w\s]/.test(password)) {
      addError(
        errors,
        "password",
        "missing_symbol",
        "Password must include at least one symbol."
      );
    }

    if (/\s/.test(password)) {
      addError(
        errors,
        "password",
        "contains_whitespace",
        "Password must not contain spaces or other whitespace characters."
      );
    }

    const loweredPassword = password.toLowerCase();

    if (
      values.username &&
      loweredPassword.includes(values.username.toLowerCase())
    ) {
      addError(
        errors,
        "password",
        "contains_username",
        "Password must not contain your username."
      );
    }

    if (values.email) {
      const emailLocalPart = values.email.split("@")[0];

      if (emailLocalPart.length >= 3 && loweredPassword.includes(emailLocalPart)) {
        addError(
          errors,
          "password",
          "contains_email",
          "Password must not contain part of your email address."
        );
      }
    }

    if (!errors.password) {
      values.password = password;
    }
  }

  if (typeof body.confirmPassword !== "string") {
    addError(
      errors,
      "confirmPassword",
      "required",
      "Password confirmation is required."
    );
  } else if (
    typeof body.password === "string" &&
    body.confirmPassword !== body.password
  ) {
    addError(
      errors,
      "confirmPassword",
      "mismatch",
      "Password confirmation does not match."
    );
  }

  if (body.termsAccepted !== true) {
    addError(
      errors,
      "termsAccepted",
      "required",
      "Terms must be accepted to create an account."
    );
  }

  return { errors, values };
}

app.post("/register", async (req, res, next) => {
  const { errors, values } = validateRegistration(req.body);

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      error: "validation_failed",
      fields: errors,
    });
  }

  try {
    const passwordHash = await bcrypt.hash(values.password, BCRYPT_COST);

    const user = await User.create({
      email: values.email,
      username: values.username,
      usernameLower: values.usernameLower,
      passwordHash,
      emailVerified: false,
    });

    return res.status(201).json({
      message: "Account created.",
      user: {
        id: user._id.toString(),
        username: user.username,
      },
    });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({
        error: "registration_unavailable",
        message: "Registration could not be completed with the provided details.",
      });
    }

    if (err && err.name === "ValidationError") {
      return res.status(400).json({
        error: "validation_failed",
        fields: {
          _form: [
            {
              code: "invalid_submission",
              message: "Submitted registration data is invalid.",
            },
          ],
        },
      });
    }

    return next(err);
  }
});

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({
      error: "invalid_json",
      message: "Request body must be valid JSON.",
    });
  }

  return res.status(500).json({
    error: "server_error",
    message: "Unable to process registration at this time.",
  });
});

async function start() {
  const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/app";
  const port = process.env.PORT || 3000;

  await mongoose.connect(mongoUri);
  app.listen(port);
}

if (require.main === module) {
  start().catch(() => {
    process.exit(1);
  });
}

module.exports = app;