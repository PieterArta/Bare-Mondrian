/* admin-dashboard.js — BARE MONDRIAN Admin Dashboard */

'use strict';

/**
 * Dashboard initialisation.
 * Currently handles placeholder fallback display for images
 * that fail to load, and any future interactivity.
 */
(function () {
    /**
     * For every <img> that has a sibling .approval-avatar-placeholder,
     * wire up the onerror fallback imperatively (in addition to the
     * inline onerror already in HTML) so we don't rely on inline handlers.
     */
    function initImageFallbacks() {
        document.querySelectorAll('.approval-avatar, .stock-img').forEach(function (img) {
            img.addEventListener('error', function () {
                img.style.display = 'none';
                var placeholder = img.nextElementSibling;
                if (placeholder) {
                    placeholder.style.display = 'flex';
                }
            });
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        initImageFallbacks();
    });
})();
