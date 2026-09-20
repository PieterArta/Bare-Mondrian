// order-confirmation.js — Order Confirmation Page for BARE MONDRIAN

(function () {
    'use strict';

    var API_BASE_URL = 'http://localhost:8000';

    // ─── Helpers ───────────────────────────────────────────────────────────────
    function formatPrice(amount) {
        var num = Math.round(Number(amount) || 0);
        return 'Rp' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    function getQueryParam(name) {
        var urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    }

    function formatStatus(status) {
        var map = {
            'pending': 'PENDING VERIFICATION',
            'approved': 'PAYMENT APPROVED',
            'rejected': 'PAYMENT REJECTED'
        };
        return map[String(status).toLowerCase()] || String(status).toUpperCase();
    }

    function getStatusClass(status) {
        var s = String(status).toLowerCase();
        if (s === 'approved') return 'confirmation-status-badge--approved';
        if (s === 'rejected') return 'confirmation-status-badge--rejected';
        return ''; // pending is default
    }

    // ─── Show/hide states ─────────────────────────────────────────────────────
    function showLoading() {
        document.getElementById('confirmation-loading').style.display = 'flex';
        document.getElementById('confirmation-container').style.display = 'none';
        document.getElementById('confirmation-error').style.display = 'none';
    }

    function showConfirmation() {
        document.getElementById('confirmation-loading').style.display = 'none';
        document.getElementById('confirmation-container').style.display = 'block';
        document.getElementById('confirmation-error').style.display = 'none';
    }

    function showError(msg) {
        document.getElementById('confirmation-loading').style.display = 'none';
        document.getElementById('confirmation-container').style.display = 'none';
        document.getElementById('confirmation-error').style.display = 'flex';
        var msgEl = document.getElementById('confirmation-error-msg');
        if (msgEl && msg) msgEl.textContent = msg;
    }

    // ─── Render order data into the confirmation card ─────────────────────────
    function renderOrder(order) {
        // Order ID
        var orderIdEl = document.getElementById('conf-order-id');
        if (orderIdEl) {
            orderIdEl.textContent = '#ORD-' + String(order.id).padStart(4, '0');
        }

        // Total Paid — sum of (unit_price × quantity) for all items
        var items = order.items || [];
        var subtotal = items.reduce(function (sum, item) {
            return sum + (Number(item.unit_price) || 0) * (Number(item.quantity) || 1);
        }, 0);
        var totalEl = document.getElementById('conf-total');
        if (totalEl) totalEl.textContent = formatPrice(subtotal);

        // Status badge
        var statusEl = document.getElementById('conf-status');
        if (statusEl) {
            statusEl.textContent = formatStatus(order.status);
            var extraClass = getStatusClass(order.status);
            if (extraClass) statusEl.classList.add(extraClass);
        }

        // Update page title
        document.title = 'ORDER #ORD-' + String(order.id).padStart(4, '0') + ' CONFIRMED — BARE MONDRIAN';

        showConfirmation();
    }

    // ─── Fetch order from API ──────────────────────────────────────────────────
    function fetchOrder(id) {
        var headers = { 'Content-Type': 'application/json' };
        var token = localStorage.getItem('token');
        if (token && token.trim() !== '') {
            headers['Authorization'] = 'Bearer ' + token.trim();
        }

        return fetch(API_BASE_URL + '/api/orders/' + id, {
            method: 'GET',
            headers: headers
        }).then(function (res) {
            if (!res.ok) throw new Error('Order not found (status ' + res.status + ')');
            return res.json();
        });
    }

    // ─── Init ─────────────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', function () {
        var orderId = getQueryParam('id');

        if (!orderId) {
            showError('No order ID was provided. Please return to the homepage.');
            return;
        }

        showLoading();

        fetchOrder(orderId)
            .then(function (order) {
                renderOrder(order);
            })
            .catch(function (err) {
                console.error('[OrderConfirmation] Fetch error:', err);
                showError(
                    'We could not retrieve order #' + orderId + '. ' +
                    'If you completed payment, your order has been received. ' +
                    'Please contact support if this persists.'
                );
            });
    });

})();
