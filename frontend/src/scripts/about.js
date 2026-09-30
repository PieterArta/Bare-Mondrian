/**
 * about.js — BARE MONDRIAN
 * Fetches dynamic About Us text content from GET /api/about-us and populates the page.
 */

(function initAboutContent() {
    'use strict';

    var API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:8000'
        : 'https://bare-mondrian.onrender.com';

    var p1El = document.getElementById('about-p1');
    var p2El = document.getElementById('about-p2');

    if (!p1El && !p2El) return;

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function renderParagraph(el, text) {
        if (!el || !text) return;
        var trimmed = text.trim();
        if (trimmed.toLowerCase().startsWith('bare mondrian')) {
            var prefix = trimmed.slice(0, 13);
            var rest = trimmed.slice(13);
            el.innerHTML = '<strong>' + escapeHtml(prefix) + '</strong>' + escapeHtml(rest);
        } else {
            el.textContent = trimmed;
        }
    }

    fetch(API_BASE_URL + '/api/about-us')
        .then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
        })
        .then(function (data) {
            if (data) {
                if (data.paragraph_1 && p1El) renderParagraph(p1El, data.paragraph_1);
                if (data.paragraph_2 && p2El) renderParagraph(p2El, data.paragraph_2);
            }
        })
        .catch(function (err) {
            console.error('[About] Failed to fetch about content from API:', err);
            // Default static HTML content remains in place seamlessly
        });
})();
