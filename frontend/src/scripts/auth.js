/**
 * auth.js — BARE MONDRIAN
 * Client-side validation & interactivity for Login and Register pages.
 * Form submission is structured for future backend wiring.
 */

(function () {
  'use strict';

  /* ─────────────────────────────────────────────
     Utility helpers
  ───────────────────────────────────────────── */

  /** Validate email format */
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  /** Show an inline error under a field */
  function showError(errorEl, inputEl, message) {
    if (errorEl) {
      errorEl.textContent = message;
    }
    if (inputEl) {
      inputEl.classList.add('error');
    }
  }

  /** Clear an inline error */
  function clearError(errorEl, inputEl) {
    if (errorEl) {
      errorEl.textContent = '';
    }
    if (inputEl) {
      inputEl.classList.remove('error');
    }
  }

  /** Wire up a show/hide password toggle button */
  function initPasswordToggle(toggleBtnId, inputId, eyeIconId, eyeOffIconId) {
    var btn = document.getElementById(toggleBtnId);
    var input = document.getElementById(inputId);
    var eyeIcon = document.getElementById(eyeIconId);
    var eyeOffIcon = document.getElementById(eyeOffIconId);

    if (!btn || !input) return;

    btn.addEventListener('click', function () {
      var isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');

      if (eyeIcon) eyeIcon.style.display = isPassword ? 'none' : 'block';
      if (eyeOffIcon) eyeOffIcon.style.display = isPassword ? 'block' : 'none';
    });
  }

  /** Clear error on input event */
  function clearOnInput(inputEl, errorEl) {
    if (!inputEl) return;
    inputEl.addEventListener('input', function () {
      clearError(errorEl, inputEl);
    });
  }

  /* ─────────────────────────────────────────────
     LOGIN PAGE
  ───────────────────────────────────────────── */
  function initLoginPage() {
    var form = document.getElementById('login-form');
    if (!form) return;

    var emailInput = document.getElementById('login-email');
    var passwordInput = document.getElementById('login-password');
    var emailError = document.getElementById('error-email');
    var passwordError = document.getElementById('error-password');

    // Password toggle
    initPasswordToggle(
      'toggle-login-password',
      'login-password',
      'icon-eye-login',
      'icon-eye-off-login'
    );

    // Clear on input
    clearOnInput(emailInput, emailError);
    clearOnInput(passwordInput, passwordError);

    // Submit handler
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var isValid = true;

      var email = emailInput ? emailInput.value.trim() : '';
      var password = passwordInput ? passwordInput.value : '';

      // Validate email
      if (!email) {
        showError(emailError, emailInput, 'Email is required.');
        isValid = false;
      } else if (!isValidEmail(email)) {
        showError(emailError, emailInput, 'Please enter a valid email address.');
        isValid = false;
      } else {
        clearError(emailError, emailInput);
      }

      // Validate password
      if (!password) {
        showError(passwordError, passwordInput, 'Password is required.');
        isValid = false;
      } else {
        clearError(passwordError, passwordInput);
      }

      if (!isValid) return;

      // TODO: Connect to backend login endpoint
      // Example:
      // fetch('/api/auth/login', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ email, password })
      // }).then(...)
      console.log('[Auth] Login submitted:', { email });
    });
  }

  /* ─────────────────────────────────────────────
     REGISTER PAGE
  ───────────────────────────────────────────── */
  function initRegisterPage() {
    var form = document.getElementById('register-form');
    if (!form) return;

    var fullnameInput = document.getElementById('register-fullname');
    var emailInput = document.getElementById('register-email');
    var phoneInput = document.getElementById('register-phone');
    var passwordInput = document.getElementById('register-password');
    var confirmInput = document.getElementById('register-confirm-password');

    var fullnameError = document.getElementById('error-fullname');
    var emailError = document.getElementById('error-reg-email');
    var phoneError = document.getElementById('error-phone');
    var passwordError = document.getElementById('error-reg-password');
    var confirmError = document.getElementById('error-confirm-password');

    // Password toggles
    initPasswordToggle(
      'toggle-reg-password',
      'register-password',
      'icon-eye-reg-pw',
      'icon-eye-off-reg-pw'
    );
    initPasswordToggle(
      'toggle-confirm-password',
      'register-confirm-password',
      'icon-eye-confirm',
      'icon-eye-off-confirm'
    );

    // Clear on input
    clearOnInput(fullnameInput, fullnameError);
    clearOnInput(emailInput, emailError);
    clearOnInput(phoneInput, phoneError);
    clearOnInput(passwordInput, passwordError);
    clearOnInput(confirmInput, confirmError);

    // Also clear confirm error when password changes
    if (passwordInput) {
      passwordInput.addEventListener('input', function () {
        clearError(confirmError, confirmInput);
      });
    }

    // Submit handler
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var isValid = true;

      var fullname = fullnameInput ? fullnameInput.value.trim() : '';
      var email = emailInput ? emailInput.value.trim() : '';
      var phone = phoneInput ? phoneInput.value.trim() : '';
      var password = passwordInput ? passwordInput.value : '';
      var confirm = confirmInput ? confirmInput.value : '';

      // Validate Full Name
      if (!fullname) {
        showError(fullnameError, fullnameInput, 'Full name is required.');
        isValid = false;
      } else {
        clearError(fullnameError, fullnameInput);
      }

      // Validate Email
      if (!email) {
        showError(emailError, emailInput, 'Email is required.');
        isValid = false;
      } else if (!isValidEmail(email)) {
        showError(emailError, emailInput, 'Please enter a valid email address.');
        isValid = false;
      } else {
        clearError(emailError, emailInput);
      }

      // Validate Phone
      if (!phone) {
        showError(phoneError, phoneInput, 'Phone number is required.');
        isValid = false;
      } else if (!/^[\d\s\+\-\(\)]{7,20}$/.test(phone)) {
        showError(phoneError, phoneInput, 'Please enter a valid phone number.');
        isValid = false;
      } else {
        clearError(phoneError, phoneInput);
      }

      // Validate Password
      if (!password) {
        showError(passwordError, passwordInput, 'Password is required.');
        isValid = false;
      } else if (password.length < 8) {
        showError(passwordError, passwordInput, 'Password must be at least 8 characters.');
        isValid = false;
      } else {
        clearError(passwordError, passwordInput);
      }

      // Validate Confirm Password
      if (!confirm) {
        showError(confirmError, confirmInput, 'Please confirm your password.');
        isValid = false;
      } else if (confirm !== password) {
        showError(confirmError, confirmInput, 'Passwords do not match.');
        isValid = false;
      } else {
        clearError(confirmError, confirmInput);
      }

      if (!isValid) return;

      // TODO: Connect to backend register endpoint
      // Example:
      // fetch('/api/auth/register', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ fullname, email, phone, password })
      // }).then(...)
      console.log('[Auth] Register submitted:', { fullname, email, phone });
    });
  }

  /* ─────────────────────────────────────────────
     Init
  ───────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    initLoginPage();
    initRegisterPage();
  });

})();
