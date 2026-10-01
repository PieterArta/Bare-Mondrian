// payment.js — Payment Page for BARE
//
// Reads order data from GET /api/orders/{id}.
// Displays items, subtotal, shipping_cost, and total exactly as the backend
// returned them — no recalculation, no hardcoded numbers.
//
// SECURITY NOTES:
// 1. File type & size checks here are UX guards only. Backend must re-validate.
// 2. QRIS image must come from a secure backend endpoint in production.
// 3. Order ID must originate from the backend (set by checkout.js after POST).
// 4. "CONFIRM PAYMENT" submits proof for admin review only.
// 5. This page must be served over HTTPS in production.

(function () {
    'use strict';

    // ─── Config ────────────────────────────────────────────────────────────────
    var API_BASE_URL = window.location.hostname === 'localhost'
        ? 'http://localhost:8000'
        : 'https://bare-mondrian.onrender.com';

    var ALLOWED_TYPES     = ['image/jpeg', 'image/png', 'image/webp'];
    var MAX_FILE_BYTES    = 5 * 1024 * 1024; // 5 MB

    // ─── State ─────────────────────────────────────────────────────────────────
    var uploadedFile = null;
    var orderId      = null;
    var orderData    = null;

    // ─── Helpers ───────────────────────────────────────────────────────────────
    function formatPrice(amount) {
        var num = Math.round(Number(amount) || 0);
        return 'Rp' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    function showUploadError(msg) {
        var el = document.getElementById('upload-error-msg');
        if (!el) return;
        el.textContent = msg;
        el.style.display = 'block';
    }

    function clearUploadError() {
        var el = document.getElementById('upload-error-msg');
        if (!el) return;
        el.textContent = '';
        el.style.display = 'none';
    }

    // ─── Read Order ID from sessionStorage (set by checkout.js) ───────────────
    function getOrderId() {
        try {
            var id = sessionStorage.getItem('currentOrderId');
            if (id && String(id).trim() !== '') return String(id).trim();
        } catch (e) {}
        return null;
    }

    // ─── Fetch order from backend ──────────────────────────────────────────────
    function fetchOrder(id) {
        var headers = { 'Content-Type': 'application/json' };
        var token = localStorage.getItem('token');
        if (token && token.trim()) headers['Authorization'] = 'Bearer ' + token.trim();

        return fetch(API_BASE_URL + '/api/orders/' + id, {
            method: 'GET',
            headers: headers
        }).then(function (res) {
            if (!res.ok) throw new Error('Order not found (HTTP ' + res.status + ')');
            return res.json();
        });
    }

    // ─── Render order data — items, totals, address ────────────────────────────
    function renderOrder(order) {
        renderOrderId(order);
        renderItems(order);
        renderTotals(order);
        renderShippingAddress(order);
        renderBigTotal(order);
    }

    function renderOrderId(order) {
        var el = document.getElementById('payment-order-id-value');
        if (el) el.textContent = '#ORD-' + String(order.id).padStart(4, '0');
    }

    function renderItems(order) {
        var listEl = document.getElementById('payment-items-list');
        if (!listEl) return;
        listEl.innerHTML = '';

        var items = order.items || [];

        if (items.length === 0) {
            listEl.innerHTML = '<p class="checkout-item-detail" style="text-align:center;padding:20px 0;">No items in order.</p>';
            return;
        }

        items.forEach(function (item, index) {
            var unitPrice = Number(item.unit_price) || 0;
            var qty       = Number(item.quantity)   || 1;
            var lineTotal = unitPrice * qty;

            // Use snapshotted product_name; fall back to product_id label
            var name = item.product_name
                ? String(item.product_name).toUpperCase()
                : 'PRODUCT #' + item.product_id;

            // Use product_image_url from the API if available
            var imgHtml;
            if (item.product_image_url) {
                imgHtml = '<img src="' + item.product_image_url + '" alt="' + name + '" class="checkout-item-img" ' +
                    'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">' +
                    '<div style="display:none;width:100%;height:100%;align-items:center;justify-content:center;background:#f0f0f0;">' +
                        '<span style="font-size:0.55rem;color:#999;letter-spacing:0.04em;">BARE</span>' +
                    '</div>';
            } else {
                imgHtml = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#f0f0f0;">' +
                    '<span style="font-size:0.55rem;color:#999;letter-spacing:0.04em;">BARE</span>' +
                    '</div>';
            }

            var row = document.createElement('div');
            row.className = 'checkout-item-row';
            row.innerHTML =
                '<div class="checkout-item-img-wrapper">' + imgHtml + '</div>' +
                '<div class="checkout-item-info">' +
                    '<h4 class="checkout-item-name">' + name + '</h4>' +
                    '<span class="checkout-item-detail">SIZE: ' + String(item.size || 'FREE SIZE').toUpperCase() + '</span>' +
                    (item.color ? '<span class="checkout-item-detail">COLOR: ' + String(item.color).toUpperCase() + '</span>' : '') +
                    '<span class="checkout-item-qty">QTY: ' + qty + '</span>' +
                '</div>' +
                '<span class="checkout-item-price">' + formatPrice(lineTotal) + '</span>';

            listEl.appendChild(row);

            if (index < items.length - 1) {
                var hr = document.createElement('hr');
                hr.className = 'checkout-items-divider';
                listEl.appendChild(hr);
            }
        });
    }

    function renderTotals(order) {
        // Use backend-computed fields: order.subtotal, order.shipping_cost, order.total
        // These are the same numbers Checkout displayed and the backend stored.
        var subtotal     = Number(order.subtotal)      || 0;
        var shippingCost = Number(order.shipping_cost) || 0;
        var total        = Number(order.total)         || 0;

        var subtotalEl  = document.getElementById('payment-subtotal');
        var shippingEl  = document.getElementById('payment-shipping');
        var totalEl     = document.getElementById('payment-total');

        if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);

        if (shippingEl) {
            shippingEl.textContent = (shippingCost > 0)
                ? formatPrice(shippingCost)
                : 'FREE SHIPPING';
        }

        if (totalEl) totalEl.textContent = formatPrice(total);
    }

    function renderBigTotal(order) {
        var total   = Number(order.total) || 0;
        var formatted = formatPrice(total);
        var qrisEl = document.getElementById('payment-total-display-qris');
        if (qrisEl) qrisEl.textContent = formatted;
    }

    function renderShippingAddress(order) {
        var block = document.getElementById('payment-shipping-address');
        if (!block) return;

        var courier = order.courier ? order.courier.toUpperCase() : '';
        var parts   = [
            order.recipient_name,
            order.recipient_phone,
            order.address,
            [order.city, order.province].filter(Boolean).join(', '),
            order.postal_code
        ].filter(Boolean);

        block.innerHTML =
            (courier ? '<p class="payment-address-courier">COURIER: ' + courier + '</p>' : '') +
            parts.map(function (p) {
                return '<p class="payment-address-line">' + p + '</p>';
            }).join('');
    }

    // ─── Guards ─────────────────────────────────────────────────────────────────
    function showFatalError(msg) {
        // Show an in-page error without redirecting so the user can see what happened
        var listEl = document.getElementById('payment-items-list');
        if (listEl) {
            listEl.innerHTML =
                '<p class="checkout-item-detail" style="text-align:center;padding:20px 0;color:#c0392b;">' +
                msg + '</p>';
        }
        var confirmBtn = document.getElementById('confirm-payment-btn');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.setAttribute('aria-disabled', 'true');
        }
    }

    // ─── File Validation ───────────────────────────────────────────────────────
    function validateFile(file) {
        if (!file) return { valid: false, error: 'No file selected.' };
        if (ALLOWED_TYPES.indexOf(file.type) === -1) {
            return { valid: false, error: 'Invalid file type. Please upload a JPEG, PNG, or WEBP image.' };
        }
        if (file.size > MAX_FILE_BYTES) {
            return { valid: false, error: 'File too large. Maximum allowed size is 5 MB.' };
        }
        return { valid: true, error: null };
    }

    function applyFile(file) {
        var result = validateFile(file);
        if (!result.valid) {
            showUploadError(result.error);
            clearFile();
            return;
        }

        clearUploadError();
        uploadedFile = file;

        var reader = new FileReader();
        reader.onload = function (e) {
            var previewImg      = document.getElementById('upload-preview-img');
            var previewFilename = document.getElementById('upload-preview-filename');
            var defaultState    = document.getElementById('upload-default-state');
            var previewState    = document.getElementById('upload-preview-state');

            if (previewImg)      previewImg.src            = e.target.result;
            if (previewFilename) previewFilename.textContent = file.name;
            if (defaultState)    defaultState.style.display  = 'none';
            if (previewState)    previewState.style.display   = 'flex';
        };
        reader.readAsDataURL(file);

        var confirmBtn = document.getElementById('confirm-payment-btn');
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.setAttribute('aria-disabled', 'false');
        }
    }

    function clearFile() {
        uploadedFile = null;
        var previewImg   = document.getElementById('upload-preview-img');
        var defaultState = document.getElementById('upload-default-state');
        var previewState = document.getElementById('upload-preview-state');
        var fileInput    = document.getElementById('payment-proof-input');

        if (previewImg)   previewImg.src           = '';
        if (defaultState) defaultState.style.display = 'flex';
        if (previewState) previewState.style.display  = 'none';
        if (fileInput)    fileInput.value             = '';

        var confirmBtn = document.getElementById('confirm-payment-btn');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.setAttribute('aria-disabled', 'true');
        }
    }

    // ─── Upload Events ────────────────────────────────────────────────────────
    function bindUploadEvents() {
        var dropzone  = document.getElementById('upload-dropzone');
        var fileInput = document.getElementById('payment-proof-input');
        var removeBtn = document.getElementById('upload-remove-btn');

        if (!dropzone || !fileInput) return;

        dropzone.addEventListener('click', function (e) {
            if (e.target === removeBtn || (removeBtn && removeBtn.contains(e.target))) return;
            fileInput.click();
        });

        dropzone.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
        });

        fileInput.addEventListener('change', function () {
            if (this.files && this.files[0]) applyFile(this.files[0]);
        });

        dropzone.addEventListener('dragover', function (e) {
            e.preventDefault(); e.stopPropagation();
            this.classList.add('drag-over');
        });

        dropzone.addEventListener('dragleave', function (e) {
            e.preventDefault(); e.stopPropagation();
            this.classList.remove('drag-over');
        });

        dropzone.addEventListener('drop', function (e) {
            e.preventDefault(); e.stopPropagation();
            this.classList.remove('drag-over');
            var files = e.dataTransfer && e.dataTransfer.files;
            if (files && files[0]) applyFile(files[0]);
        });

        if (removeBtn) {
            removeBtn.addEventListener('click', function (e) {
                e.preventDefault(); e.stopPropagation();
                clearFile();
                clearUploadError();
            });
        }
    }

    // ─── Confirm Payment ──────────────────────────────────────────────────────
    function bindConfirmButton() {
        var confirmBtn = document.getElementById('confirm-payment-btn');
        if (!confirmBtn) return;

        confirmBtn.addEventListener('click', function () {
            if (!uploadedFile) return;
            if (!orderId) {
                showUploadError('Order ID is missing. Please return to checkout.');
                return;
            }

            // Guard: do not re-submit an already-uploaded proof
            if (orderData && orderData.payment_proof_url) {
                showUploadError('A payment proof has already been submitted for this order.');
                return;
            }

            var formData = new FormData();
            formData.append('payment_method', 'qris');
            if (uploadedFile) {
                formData.append('file', uploadedFile, uploadedFile.name);
            }

            var originalText = confirmBtn.textContent;
            confirmBtn.disabled = true;
            confirmBtn.setAttribute('aria-disabled', 'true');
            confirmBtn.textContent = 'SUBMITTING…';

            var headers = {};
            var token = localStorage.getItem('token');
            if (token && token.trim()) headers['Authorization'] = 'Bearer ' + token.trim();

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
                        showUploadError(errMsg);
                        confirmBtn.disabled = false;
                        confirmBtn.setAttribute('aria-disabled', 'false');
                        confirmBtn.textContent = originalText;
                        return;
                    }

                    // Success: clean up sessionStorage and redirect
                    try {
                        sessionStorage.setItem('lastCompletedOrderId', orderId);
                        sessionStorage.removeItem('currentOrderId');
                    } catch (e) {}

                    window.location.href = '/pages/order-confirmation?id=' + orderId;
                })
                .catch(function (err) {
                    console.error('[Payment] Upload error:', err);
                    showUploadError('Network error. Please check your connection and try again.');
                    confirmBtn.disabled = false;
                    confirmBtn.setAttribute('aria-disabled', 'false');
                    confirmBtn.textContent = originalText;
                });
        });
    }

    // ─── Init ─────────────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', function () {
        orderId = getOrderId();

        if (!orderId) {
            // No order in progress — send back to checkout
            window.location.href = '/pages/checkout';
            return;
        }

        // Show loading skeleton in summary
        var listEl = document.getElementById('payment-items-list');
        if (listEl) {
            listEl.innerHTML =
                '<p class="checkout-item-detail" style="text-align:center;padding:20px 0;color:#999;">LOADING ORDER…</p>';
        }
        var orderIdValueEl = document.getElementById('payment-order-id-value');
        if (orderIdValueEl) orderIdValueEl.textContent = '#ORD-' + String(orderId).padStart(4, '0');

        fetchOrder(orderId)
            .then(function (data) {
                orderData = data;

                // Guard: already paid (proof uploaded) — still show data but note status
                renderOrder(data);

                if (data.payment_proof_url) {
                    var note = document.getElementById('payment-already-paid-note');
                    if (note) note.style.display = 'block';
                }
            })
            .catch(function (err) {
                console.error('[Payment] Fetch order error:', err);
                showFatalError('FAILED TO LOAD ORDER. PLEASE RETURN TO CHECKOUT AND TRY AGAIN.');
            });

        bindUploadEvents();
        bindConfirmButton();
    });

})();
