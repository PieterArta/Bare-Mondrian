/**
 * auth.js — BARE MONDRIAN
 * Authentication logic, form handling, JWT & role storage, show/hide password toggle,
 * account dropdown behavior, and logout functionality.
 */

(function () {
  'use strict';

  var API_BASE_URL = 'http://localhost:8000';

  /* ─────────────────────────────────────────────
     Google OAuth Configuration
  ───────────────────────────────────────────── */
  // Paste your real Google Client ID from Google Cloud Console below:
  var GOOGLE_CLIENT_ID = 'CLIENT_ID_PLACEHOLDER';

  /** Handle ID token credential response returned from Google Sign-In */
  function handleGoogleCredentialResponse(response) {
    var formError = document.getElementById('form-error-login') || document.getElementById('form-error-register');
    if (!response || !response.credential) {
      if (formError) showFormError(formError, 'Google Sign-In failed to return credentials.');
      return;
    }

    fetch(API_BASE_URL + '/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: response.credential })
    })
      .then(function (res) {
        if (!res.ok) {
          return res.json().then(function (data) {
            throw new Error((data && data.detail) || 'Google authentication failed.');
          });
        }
        return res.json();
      })
      .then(function (data) {
        if (data.access_token) {
          localStorage.setItem('token', data.access_token);
          var role = (data.user && data.user.role) ? data.user.role : 'customer';
          localStorage.setItem('role', role);

          if (data.user) {
            if (data.user.email) localStorage.setItem('user_email', data.user.email);
            if (data.user.full_name) localStorage.setItem('user_name', data.user.full_name);
          }

          if (role === 'admin') {
            window.location.href = '../admin/dashboard.html';
          } else {
            window.location.href = 'index.html';
          }
        } else {
          if (formError) showFormError(formError, 'Google login failed. Invalid response from server.');
        }
      })
      .catch(function (err) {
        console.error('[Auth] Google login error:', err);
        if (formError) showFormError(formError, err.message || 'Google Sign-In failed. Please try again.');
      });
  }

  /** Initialize Google GIS and wire up Google Sign-In button */
  function initGoogleSignInButton(buttonId, formErrorId) {
    var googleBtn = document.getElementById(buttonId);
    if (!googleBtn) return;

    googleBtn.addEventListener('click', function (e) {
      e.preventDefault();
      var formError = document.getElementById(formErrorId);
      if (formError) clearFormError(formError);

      if (GOOGLE_CLIENT_ID === 'CLIENT_ID_PLACEHOLDER') {
        console.warn('[Auth] GOOGLE_CLIENT_ID is set to placeholder. Replace it with your Google Client ID in auth.js.');
      }

      if (typeof google === 'undefined' || !google.accounts || !google.accounts.id) {
        if (formError) showFormError(formError, 'Google Sign-In library is loading or blocked. Please refresh and try again.');
        return;
      }

      try {
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredentialResponse,
          auto_select: false
        });

        google.accounts.id.prompt(function (notification) {
          if (notification.isNotDisplayed()) {
            var reason = notification.getNotDisplayedReason();
            console.warn('[Auth] Google prompt not displayed reason:', reason);
          }
        });
      } catch (err) {
        console.error('[Auth] Error initiating Google Sign-In:', err);
        if (formError) showFormError(formError, 'Could not start Google Sign-In. Please check Client ID configuration.');
      }
    });
  }

  /* ─────────────────────────────────────────────
     Auth state & helpers (exposed globally)
  ───────────────────────────────────────────── */

  function isLoggedIn() {
    var token = localStorage.getItem('token');
    return Boolean(token && token.trim() !== '');
  }

  function getUserRole() {
    return localStorage.getItem('role') || null;
  }

  function logout(e) {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_name');

    // Determine correct login path based on current directory
    if (window.location.pathname.indexOf('/admin/') !== -1) {
      window.location.href = '../pages/login.html';
    } else {
      window.location.href = 'login.html';
    }
  }

  // Expose helpers globally for use across the site
  window.isLoggedIn = isLoggedIn;
  window.getUserRole = getUserRole;
  window.logout = logout;

  /* ─────────────────────────────────────────────
     Utility helpers
  ───────────────────────────────────────────── */

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

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

  /** Show top-level form error banner */
  function showFormError(formErrorEl, message) {
    if (!formErrorEl) return;
    formErrorEl.textContent = message;
    formErrorEl.classList.add('active');
  }

  /** Clear top-level form error banner */
  function clearFormError(formErrorEl) {
    if (!formErrorEl) return;
    formErrorEl.textContent = '';
    formErrorEl.classList.remove('active');
  }

  /** Wire up a show/hide password toggle button */
  function initPasswordToggle(toggleBtnId, inputId, eyeIconId, eyeOffIconId) {
    var btn = document.getElementById(toggleBtnId);
    var input = document.getElementById(inputId);
    var eyeIcon = document.getElementById(eyeIconId);
    var eyeOffIcon = document.getElementById(eyeOffIconId);

    if (!btn || !input) return;

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');

      if (eyeIcon) eyeIcon.style.display = isPassword ? 'none' : 'block';
      if (eyeOffIcon) eyeOffIcon.style.display = isPassword ? 'block' : 'none';
    });
  }

  /** Clear error on input event */
  function clearOnInput(inputEl, errorEl, formErrorEl) {
    if (!inputEl) return;
    inputEl.addEventListener('input', function () {
      clearError(errorEl, inputEl);
      if (formErrorEl) clearFormError(formErrorEl);
    });
  }

  /* ─────────────────────────────────────────────
     ACCOUNT ICON & DROPDOWN MENU LOGIC
  ───────────────────────────────────────────── */
  function initAccountDropdown() {
    var accountBtns = document.querySelectorAll('#btn-account, #btn-topbar-account');
    if (!accountBtns || accountBtns.length === 0) return;

    accountBtns.forEach(function (btn) {
      var parent = btn.parentElement;
      if (parent && getComputedStyle(parent).position === 'static') {
        parent.style.position = 'relative';
      }

      var dropdownId = 'dropdown-' + (btn.id || 'account');
      var dropdown = document.getElementById(dropdownId);

      if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = dropdownId;
        dropdown.className = 'account-dropdown';

        var userEmail = localStorage.getItem('user_email') || localStorage.getItem('user_name') || 'MEMBER ACCOUNT';

        dropdown.innerHTML =
          '<div class="account-dropdown-info">' +
            '<span class="account-dropdown-label">LOGGED IN AS</span>' +
            '<span class="account-dropdown-user">' + escapeHtml(userEmail) + '</span>' +
          '</div>' +
          '<hr class="account-dropdown-divider">' +
          '<button type="button" class="account-dropdown-logout">LOGOUT</button>';

        parent.appendChild(dropdown);

        var logoutBtn = dropdown.querySelector('.account-dropdown-logout');
        if (logoutBtn) {
          logoutBtn.addEventListener('click', function (e) {
            logout(e);
          });
        }
      }

      btn.addEventListener('click', function (e) {
        if (!isLoggedIn()) {
          // If NOT logged in: navigate to login.html
          if (window.location.pathname.indexOf('/admin/') !== -1) {
            window.location.href = '../pages/login.html';
          } else if (window.location.pathname.indexOf('login.html') === -1) {
            window.location.href = 'login.html';
          }
          return;
        }

        // If logged in: toggle account dropdown menu
        e.preventDefault();
        e.stopPropagation();

        // Close any other open account dropdowns
        document.querySelectorAll('.account-dropdown').forEach(function (d) {
          if (d !== dropdown) d.classList.remove('active');
        });

        // Refresh user info label
        var userEl = dropdown.querySelector('.account-dropdown-user');
        if (userEl) {
          var userEmail = localStorage.getItem('user_email') || localStorage.getItem('user_name') || 'MEMBER ACCOUNT';
          userEl.textContent = userEmail;
        }

        dropdown.classList.toggle('active');
      });
    });

    // Close dropdown on outside click
    document.addEventListener('click', function (e) {
      document.querySelectorAll('.account-dropdown').forEach(function (dropdown) {
        if (!dropdown.contains(e.target) && !e.target.closest('#btn-account') && !e.target.closest('#btn-topbar-account')) {
          dropdown.classList.remove('active');
        }
      });
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
    var formError = document.getElementById('form-error-login');
    var submitBtn = document.getElementById('btn-login');

    // Password toggle
    initPasswordToggle(
      'toggle-login-password',
      'login-password',
      'icon-eye-login',
      'icon-eye-off-login'
    );

    // Clear errors on input
    clearOnInput(emailInput, emailError, formError);
    clearOnInput(passwordInput, passwordError, formError);

    // Google Sign-In button handler
    initGoogleSignInButton('btn-google-login', 'form-error-login');

    // Submit handler
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearFormError(formError);

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

      // Loading state
      var originalBtnText = submitBtn ? submitBtn.textContent : 'LOGIN';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'LOGGING IN...';
      }

      fetch(API_BASE_URL + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password })
      })
        .then(function (res) {
          if (!res.ok) {
            throw new Error('UNAUTHORIZED');
          }
          return res.json();
        })
        .then(function (data) {
          if (data.access_token) {
            localStorage.setItem('token', data.access_token);
            var role = (data.user && data.user.role) ? data.user.role : 'customer';
            localStorage.setItem('role', role);

            if (data.user) {
              if (data.user.email) localStorage.setItem('user_email', data.user.email);
              if (data.user.full_name) localStorage.setItem('user_name', data.user.full_name);
            }

            // Redirect based on role
            if (role === 'admin') {
              window.location.href = '../admin/dashboard.html';
            } else {
              window.location.href = 'index.html';
            }
          } else {
            showFormError(formError, 'Login failed. Invalid response from server.');
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = originalBtnText;
            }
          }
        })
        .catch(function (err) {
          console.error('[Auth] Login error:', err);
          showFormError(formError, 'Invalid email or password.');
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
          }
        });
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
    var formError = document.getElementById('form-error-register');
    var submitBtn = document.getElementById('btn-register');

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

    // Clear errors on input
    clearOnInput(fullnameInput, fullnameError, formError);
    clearOnInput(emailInput, emailError, formError);
    clearOnInput(phoneInput, phoneError, formError);
    clearOnInput(passwordInput, passwordError, formError);
    clearOnInput(confirmInput, confirmError, formError);

    // Also clear confirm error when password changes
    if (passwordInput) {
      passwordInput.addEventListener('input', function () {
        clearError(confirmError, confirmInput);
      });
    }

    // Google Sign-In button handler
    initGoogleSignInButton('btn-google-register', 'form-error-register');

    // Submit handler
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearFormError(formError);

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
      } else {
        clearError(phoneError, phoneInput);
      }

      // Validate Password
      if (!password) {
        showError(passwordError, passwordInput, 'Password is required.');
        isValid = false;
      } else if (password.length < 6) {
        showError(passwordError, passwordInput, 'Password must be at least 6 characters.');
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

      // Loading state
      var originalBtnText = submitBtn ? submitBtn.textContent : 'REGISTER';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'REGISTERING...';
      }

      fetch(API_BASE_URL + '/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullname,
          email: email,
          phone: phone,
          password: password
        })
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { status: res.status, ok: res.ok, data: data };
          });
        })
        .then(function (result) {
          if (!result.ok) {
            var errorMsg = (result.data && result.data.detail)
              ? result.data.detail
              : 'Registration failed. Please check your information.';
            if (result.status === 409) {
              showError(emailError, emailInput, errorMsg);
            } else {
              showFormError(formError, errorMsg);
            }
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = originalBtnText;
            }
            return;
          }

          var data = result.data;
          if (data.access_token) {
            localStorage.setItem('token', data.access_token);
            var role = (data.user && data.user.role) ? data.user.role : 'customer';
            localStorage.setItem('role', role);

            if (data.user) {
              if (data.user.email) localStorage.setItem('user_email', data.user.email);
              if (data.user.full_name) localStorage.setItem('user_name', data.user.full_name);
            }

            // Customer registration redirects to index.html
            window.location.href = 'index.html';
          }
        })
        .catch(function (err) {
          console.error('[Auth] Register error:', err);
          showFormError(formError, 'An error occurred during registration. Please try again.');
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
          }
        });
    });
  }

  /* ─────────────────────────────────────────────
     Logout listeners setup
  ───────────────────────────────────────────── */
  function initLogoutListeners() {
    var logoutBtns = document.querySelectorAll('#btn-logout, .sidebar-logout');
    logoutBtns.forEach(function (btn) {
      btn.addEventListener('click', logout);
    });
  }

  /* ─────────────────────────────────────────────
     Init
  ───────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    initLoginPage();
    initRegisterPage();
    initLogoutListeners();
    initAccountDropdown();
  });

})();
