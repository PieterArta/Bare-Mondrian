/**
 * about-settings.js — BARE MONDRIAN Admin
 * Manage About Us page text content (Paragraph 1 and Paragraph 2).
 */

'use strict';

var API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8000'
    : 'https://bare-mondrian.onrender.com';

/* -------------------------------------------------------
   AUTH GUARD
   ------------------------------------------------------- */
function guardAdmin() {
    if (typeof window.isLoggedIn === 'function' && typeof window.getUserRole === 'function') {
        if (!window.isLoggedIn() || window.getUserRole() !== 'admin') {
            window.location.href = '../pages/login';
            return false;
        }
        return true;
    }
    var token = localStorage.getItem('token');
    var role = localStorage.getItem('role');
    if (!token || role !== 'admin') {
        window.location.href = '../pages/login';
        return false;
    }
    return true;
}

function getAuthHeaders() {
    var token = localStorage.getItem('token');
    var h = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = 'Bearer ' + token;
    return h;
}

/* -------------------------------------------------------
   STATE
   ------------------------------------------------------- */
var loadedState = {
    paragraph_1: '',
    paragraph_2: ''
};

// DOM refs resolved in DOMContentLoaded
var p1Input, p2Input, errP1, errP2, statusMsg, btnCancel, btnSave, form;

/* -------------------------------------------------------
   HELPERS
   ------------------------------------------------------- */
function showStatus(msg, isError) {
    if (!statusMsg) return;
    statusMsg.textContent = msg;
    statusMsg.style.display = 'block';
    statusMsg.style.backgroundColor = isError ? '#fce8e6' : '#e6f4ea';
    statusMsg.style.color = isError ? '#c0392b' : '#1e7e34';
    statusMsg.style.border = isError ? '1px solid #f5c6cb' : '1px solid #c3e6cb';
}

function hideStatus() {
    if (statusMsg) {
        statusMsg.style.display = 'none';
        statusMsg.textContent = '';
    }
}

function clearErrors() {
    if (errP1) { errP1.textContent = ''; errP1.style.display = 'none'; }
    if (errP2) { errP2.textContent = ''; errP2.style.display = 'none'; }
    hideStatus();
}

/* -------------------------------------------------------
   FETCH & RENDER
   ------------------------------------------------------- */
function fetchAboutContent() {
    if (!p1Input || !p2Input) return;

    fetch(API_BASE_URL + '/api/about-us')
        .then(function (res) {
            if (!res.ok) throw new Error('Failed to load About Us content');
            return res.json();
        })
        .then(function (data) {
            if (data) {
                loadedState.paragraph_1 = data.paragraph_1 || '';
                loadedState.paragraph_2 = data.paragraph_2 || '';
                p1Input.value = loadedState.paragraph_1;
                p2Input.value = loadedState.paragraph_2;
            }
        })
        .catch(function (err) {
            console.error('[AboutSettings] Fetch error:', err);
            showStatus('Failed to load current content. ' + err.message, true);
        });
}

/* -------------------------------------------------------
   SAVE & CANCEL ACTIONS
   ------------------------------------------------------- */
function handleSave() {
    clearErrors();

    var val1 = p1Input ? p1Input.value.trim() : '';
    var val2 = p2Input ? p2Input.value.trim() : '';

    var hasError = false;
    if (!val1) {
        if (errP1) { errP1.textContent = 'Paragraph 1 cannot be empty.'; errP1.style.display = 'block'; }
        hasError = true;
    }
    if (!val2) {
        if (errP2) { errP2.textContent = 'Paragraph 2 cannot be empty.'; errP2.style.display = 'block'; }
        hasError = true;
    }

    if (hasError) return;

    if (btnSave) {
        btnSave.disabled = true;
        btnSave.textContent = 'SAVING...';
    }

    fetch(API_BASE_URL + '/api/about-us', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
            paragraph_1: val1,
            paragraph_2: val2
        })
    })
    .then(function (res) {
        if (res.status === 401) {
            // Stale or mismatched JWT — clear storage and force re-login
            localStorage.removeItem('token');
            localStorage.removeItem('role');
            window.location.href = '../pages/login';
            return;
        }
        if (!res.ok) {
            return res.json().then(function (err) {
                throw new Error((err && err.detail) || 'Failed to update About Us content');
            }).catch(function () {
                throw new Error('Update failed (status ' + res.status + ')');
            });
        }
        return res.json();
    })
    .then(function (data) {
        if (btnSave) {
            btnSave.disabled = false;
            btnSave.textContent = 'SAVE CHANGES';
        }

        loadedState.paragraph_1 = data.paragraph_1 || val1;
        loadedState.paragraph_2 = data.paragraph_2 || val2;
        p1Input.value = loadedState.paragraph_1;
        p2Input.value = loadedState.paragraph_2;

        showStatus('About Us page content updated successfully!', false);
    })
    .catch(function (err) {
        if (btnSave) {
            btnSave.disabled = false;
            btnSave.textContent = 'SAVE CHANGES';
        }
        console.error('[AboutSettings] Update error:', err);
        showStatus(err.message || 'Failed to update About Us content.', true);
    });
}

function handleCancel() {
    clearErrors();
    if (p1Input) p1Input.value = loadedState.paragraph_1;
    if (p2Input) p2Input.value = loadedState.paragraph_2;
}

/* -------------------------------------------------------
   MOBILE SIDEBAR TOGGLE
   ------------------------------------------------------- */
function initSidebarToggle() {
    var hamburgerBtn = document.getElementById('admin-hamburger-btn');
    var sidebar = document.getElementById('admin-sidebar');
    var overlay = document.getElementById('admin-sidebar-overlay');

    if (hamburgerBtn && sidebar && overlay) {
        hamburgerBtn.addEventListener('click', function () {
            sidebar.classList.add('active');
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        });

        overlay.addEventListener('click', function () {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        });
    }
}

/* -------------------------------------------------------
   BOOT
   ------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', function () {
    if (!guardAdmin()) return;

    // Resolve DOM refs now that the document is ready
    p1Input   = document.getElementById('about-paragraph-1');
    p2Input   = document.getElementById('about-paragraph-2');
    errP1     = document.getElementById('err-paragraph-1');
    errP2     = document.getElementById('err-paragraph-2');
    statusMsg = document.getElementById('about-status-message');
    btnCancel = document.getElementById('btn-about-cancel');
    btnSave   = document.getElementById('btn-about-save');
    form      = document.getElementById('about-settings-form');

    fetchAboutContent();

    if (btnSave) btnSave.addEventListener('click', handleSave);
    if (btnCancel) btnCancel.addEventListener('click', handleCancel);
    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            handleSave();
        });
    }

    initSidebarToggle();
});
