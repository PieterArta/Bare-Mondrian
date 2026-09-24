// payment.js — Payment Proof Upload & Order Summary for BARE MONDRIAN
//
// SECURITY NOTES (client-side only — server must independently validate everything):
// 1. File type & size checks here are UX guards only. The backend MUST re-validate.
// 2. The QRIS image src must come from a secure, authenticated backend endpoint in production.
// 3. The Order ID must originate from the backend — never generated or trusted from the client.
// 4. "CONFIRM PAYMENT" only submits proof for admin review; it does NOT mark payment as approved.
// 5. This page must be served over HTTPS in production. (Netlify/Vercel enforce this by default.)

(function () {
    'use strict';

    // ─── Config ────────────────────────────────────────────────────────────────
    var API_BASE_URL = 'https://bare-mondrian.onrender.com';
    var ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
    var MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

    // ─── State ─────────────────────────────────────────────────────────────────
    var uploadedFile = null;
    var orderId = null;
    var orderData = null;

    // ─── Helpers ───────────────────────────────────────────────────────────────
    function formatPrice(amount) {
        var num = Math.round(Number(amount) || 0);
        return 'Rp' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    function showError(msg) {
        var errorEl = document.getElementById('upload-error-msg');
        if (!errorEl) return;
        errorEl.textContent = msg;
        errorEl.style.display = 'block';
    }

    function clearError() {
        var errorEl = document.getElementById('upload-error-msg');
        if (!errorEl) return;
        errorEl.textContent = '';
        errorEl.style.display = 'none';
    }

    // ─── Step 1: Get Order ID from sessionStorage ──────────────────────────────
    function getOrderId() {
        try {
            // Read the key set by checkout.js on successful order submission
            var id = sessionStorage.getItem('currentOrderId');
            if (id && String(id).trim() !== '') {
                return String(id).trim();
            }
        } catch (e) {
            // sessionStorage unavailable
        }
        return null;
    }

    // ─── Step 2: Fetch order from backend ─────────────────────────────────────
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
            if (!res.ok) {
                throw new Error('Order not found (status ' + res.status + ')');
            }
            return res.json();
        });
    }

    // ─── Step 3: Render Order Summary from API data ────────────────────────────
    function renderOrderSummary(order) {
        var orderIdValueEl = document.getElementById('payment-order-id-value');
        var listEl = document.getElementById('payment-items-list');
        var subtotalEl = document.getElementById('payment-subtotal');
        var shippingEl = document.getElementById('payment-shipping');
        var totalEl = document.getElementById('payment-total');
        var totalDisplayEl = document.getElementById('payment-total-display');

        if (orderIdValueEl) {
            orderIdValueEl.textContent = '#ORD-' + String(order.id).padStart(4, '0');
        }

        if (!listEl) return;
        listEl.innerHTML = '';

        var items = order.items || [];

        if (items.length === 0) {
            listEl.innerHTML = '<p class="checkout-item-detail" style="text-align:center;padding:20px 0;">No items in order.</p>';
        } else {
            items.forEach(function (item, index) {
                var itemRow = document.createElement('div');
                itemRow.className = 'checkout-item-row';

                var unitPrice = Number(item.unit_price) || 0;
                var qty = Number(item.quantity) || 1;
                var lineTotal = unitPrice * qty;

                itemRow.innerHTML =
                    '<div class="checkout-item-img-wrapper">' +
                        '<div style="width:100%;height:100%;background:#e0e0e0;display:flex;align-items:center;justify-content:center;">' +
                            '<span style="font-size:0.6rem;color:#999;letter-spacing:0.04em;">PRODUCT</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="checkout-item-info">' +
                        '<h4 class="checkout-item-name">PRODUCT #' + item.product_id + '</h4>' +
                        '<span class="checkout-item-detail">SIZE: ' + (item.size || 'FREE SIZE').toUpperCase() + '</span>' +
                        (item.color ? '<span class="checkout-item-detail">COLOR: ' + item.color.toUpperCase() + '</span>' : '') +
                        '<span class="checkout-item-qty">QTY: ' + qty + '</span>' +
                    '</div>' +
                    '<span class="checkout-item-price">' + formatPrice(lineTotal) + '</span>';

                listEl.appendChild(itemRow);

                if (index < items.length - 1) {
                    var divider = document.createElement('hr');
                    divider.className = 'checkout-items-divider';
                    listEl.appendChild(divider);
                }
            });
        }

        // Calculate totals from item data
        var subtotal = items.reduce(function (sum, item) {
            return sum + (Number(item.unit_price) || 0) * (Number(item.quantity) || 1);
        }, 0);
        var shipping = 0; // Complimentary placeholder
        var total = subtotal + shipping;

        if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
        if (shippingEl) shippingEl.textContent = 'COMPLIMENTARY';
        if (totalEl) totalEl.textContent = formatPrice(total);
        if (totalDisplayEl) totalDisplayEl.textContent = formatPrice(total);
    }

    // ─── File Validation ───────────────────────────────────────────────────────
    function validateFile(file) {
        if (!file) return { valid: false, error: 'No file selected.' };
        if (ALLOWED_TYPES.indexOf(file.type) === -1) {
            return { valid: false, error: 'Invalid file type. Please upload a JPEG, PNG, or WEBP image.' };
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
            return { valid: false, error: 'File too large. Maximum allowed size is 5MB.' };
        }
        return { valid: true, error: null };
    }

    // ─── Apply selected file: preview + enable button ──────────────────────────
    function applyFile(file) {
        var result = validateFile(file);
        if (!result.valid) {
            showError(result.error);
            clearFile();
            return;
        }

        clearError();
        uploadedFile = file;

        var reader = new FileReader();
        reader.onload = function (e) {
            var previewImg = document.getElementById('upload-preview-img');
            var previewFilename = document.getElementById('upload-preview-filename');
            var defaultState = document.getElementById('upload-default-state');
            var previewState = document.getElementById('upload-preview-state');

            if (previewImg) previewImg.src = e.target.result;
            if (previewFilename) previewFilename.textContent = file.name;
            if (defaultState) defaultState.style.display = 'none';
            if (previewState) previewState.style.display = 'flex';
        };
        reader.readAsDataURL(file);

        var confirmBtn = document.getElementById('confirm-payment-btn');
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.setAttribute('aria-disabled', 'false');
        }
    }

    // ─── Clear selected file ───────────────────────────────────────────────────
    function clearFile() {
        uploadedFile = null;

        var previewImg = document.getElementById('upload-preview-img');
        var defaultState = document.getElementById('upload-default-state');
        var previewState = document.getElementById('upload-preview-state');
        var fileInput = document.getElementById('payment-proof-input');

        if (previewImg) previewImg.src = '';
        if (defaultState) defaultState.style.display = 'flex';
        if (previewState) previewState.style.display = 'none';
        if (fileInput) fileInput.value = '';

        var confirmBtn = document.getElementById('confirm-payment-btn');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.setAttribute('aria-disabled', 'true');
        }
    }

    // ─── Bind Upload Events ────────────────────────────────────────────────────
    function bindUploadEvents() {
        var dropzone = document.getElementById('upload-dropzone');
        var fileInput = document.getElementById('payment-proof-input');
        var removeBtn = document.getElementById('upload-remove-btn');

        if (!dropzone || !fileInput) return;

        // Click on dropzone triggers hidden file input
        dropzone.addEventListener('click', function (e) {
            if (e.target === removeBtn || (removeBtn && removeBtn.contains(e.target))) return;
            fileInput.click();
        });

        // Keyboard accessibility
        dropzone.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInput.click();
            }
        });

        // File input change
        fileInput.addEventListener('change', function () {
            if (this.files && this.files[0]) {
                applyFile(this.files[0]);
            }
        });

        // Drag-and-drop
        dropzone.addEventListener('dragover', function (e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.add('drag-over');
        });

        dropzone.addEventListener('dragleave', function (e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.remove('drag-over');
        });

        dropzone.addEventListener('drop', function (e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.remove('drag-over');
            var files = e.dataTransfer && e.dataTransfer.files;
            if (files && files[0]) applyFile(files[0]);
        });

        // Remove button
        if (removeBtn) {
            removeBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                clearFile();
                clearError();
            });
        }
    }

    // ─── Bind Confirm Payment Button ───────────────────────────────────────────
    function bindConfirmButton() {
        var confirmBtn = document.getElementById('confirm-payment-btn');
        if (!confirmBtn) return;

        confirmBtn.addEventListener('click', function () {
            if (!uploadedFile) return;
            if (!orderId) {
                showError('Order ID is missing. Please return to checkout.');
                return;
            }

            var formData = new FormData();
            // Backend endpoint uses the field name "file"
            formData.append('file', uploadedFile, uploadedFile.name);

            // Loading state
            var originalText = this.textContent;
            this.disabled = true;
            this.setAttribute('aria-disabled', 'true');
            this.textContent = 'SUBMITTING…';

            var headers = {};
            var token = localStorage.getItem('token');
            if (token && token.trim() !== '') {
                headers['Authorization'] = 'Bearer ' + token.trim();
            }

            fetch(API_BASE_URL + '/api/orders/' + orderId + '/payment-proof', {
                method: 'POST',
                headers: headers,
                body: formData
            })
                .then(function (res) {
                    return res.json().then(function (data) {
                        return { ok: res.ok, status: res.status, data: data };
                    });
                })
                .then(function (result) {
                    if (!result.ok) {
                        var errMsg = (result.data && result.data.detail)
                            ? result.data.detail
                            : 'Upload failed. Please try again.';
                        showError(errMsg);
                        confirmBtn.disabled = false;
                        confirmBtn.setAttribute('aria-disabled', 'false');
                        confirmBtn.textContent = originalText;
                        return;
                    }

                    // Success: set lastCompletedOrderId in sessionStorage and redirect
                    try {
                        sessionStorage.setItem('lastCompletedOrderId', orderId);
                        sessionStorage.removeItem('currentOrderId');
                    } catch (e) {}
                    window.location.href = '/pages/order-confirmation?id=' + orderId;
                })
                .catch(function (err) {
                    console.error('[Payment] Upload error:', err);
                    showError('Network error. Please check your connection and try again.');
                    confirmBtn.disabled = false;
                    confirmBtn.setAttribute('aria-disabled', 'false');
                    confirmBtn.textContent = originalText;
                });
        });
    }

    // ─── Init ──────────────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', function () {
        orderId = getOrderId();

        if (!orderId) {
            // No order ID — redirect back to checkout
            window.location.href = '/pages/checkout';
            return;
        }

        // Show loading state in summary while fetching
        var listEl = document.getElementById('payment-items-list');
        if (listEl) {
            listEl.innerHTML = '<p class="checkout-item-detail" style="text-align:center;padding:20px 0;color:#999;">LOADING ORDER…</p>';
        }
        var orderIdValueEl = document.getElementById('payment-order-id-value');
        if (orderIdValueEl) orderIdValueEl.textContent = '#ORD-' + String(orderId).padStart(4, '0');

        fetchOrder(orderId)
            .then(function (data) {
                orderData = data;
                renderOrderSummary(data);
            })
            .catch(function (err) {
                console.error('[Payment] Fetch order error:', err);
                if (listEl) {
                    listEl.innerHTML = '<p class="checkout-item-detail" style="text-align:center;padding:20px 0;color:#c0392b;">FAILED TO LOAD ORDER. PLEASE RETURN TO CHECKOUT.</p>';
                }
            });

        bindUploadEvents();
        bindConfirmButton();
    });

})();
