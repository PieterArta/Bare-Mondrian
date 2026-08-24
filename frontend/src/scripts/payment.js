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
    var ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
    var MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
    var SHIPPING_COST = 10000;

    // ─── State ─────────────────────────────────────────────────────────────────
    var uploadedFile = null; // tracks the currently selected File object

    // ─── Retrieve order ID ─────────────────────────────────────────────────────
    // In production this value is set by the backend after order creation
    // (e.g., embedded in a signed session or API response, NOT from the URL query string
    // to prevent order-ID guessing/tampering). The placeholder below will be replaced
    // with a backend-provided value once the API is wired up.
    var orderId = null;
    try {
        var savedOrder = sessionStorage.getItem('bare_mondrian_pending_order');
        if (savedOrder) {
            var parsedOrder = JSON.parse(savedOrder);
            // Only use the ID if it looks like a server-generated value (non-empty string)
            if (parsedOrder && parsedOrder.orderId && typeof parsedOrder.orderId === 'string') {
                orderId = parsedOrder.orderId;
            }
        }
    } catch (e) {
        // sessionStorage unavailable or parse error — orderId stays null
    }

    var orderIdValueEl = document.getElementById('payment-order-id-value');
    if (orderIdValueEl) {
        // Show placeholder text if no backend-provided ID is available yet
        orderIdValueEl.textContent = orderId ? '#' + orderId : '#ORD-DEMO';
    }

    // ─── Retrieve cart items ────────────────────────────────────────────────────
    // Reads from the same localStorage key used by cart.js and checkout.js
    var defaultCartItems = [
        {
            id: 'item-1',
            name: 'STRUCTURE TEE - BLK',
            size: 'L',
            quantity: 1,
            price: 150000,
            image: 'assets/images/products/produk1.jpg'
        },
        {
            id: 'item-2',
            name: 'GRID TOTE - WHT',
            size: 'OS',
            quantity: 1,
            price: 200000,
            image: 'assets/images/products/produk2.jpg'
        }
    ];

    var cartItems = [];
    try {
        var saved = localStorage.getItem('bare_mondrian_cart');
        if (saved) {
            cartItems = JSON.parse(saved);
        } else {
            cartItems = defaultCartItems;
        }
    } catch (e) {
        cartItems = defaultCartItems;
    }

    // ─── Helpers ───────────────────────────────────────────────────────────────
    function formatPrice(amount) {
        return 'Rp' + amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    function getSubtotal() {
        return cartItems.reduce(function (sum, item) {
            return sum + item.price * item.quantity;
        }, 0);
    }

    function getTotal() {
        return getSubtotal() + SHIPPING_COST;
    }

    // ─── Render Order Summary ──────────────────────────────────────────────────
    function renderOrderSummary() {
        var listEl = document.getElementById('payment-items-list');
        var subtotalEl = document.getElementById('payment-subtotal');
        var shippingEl = document.getElementById('payment-shipping');
        var totalEl = document.getElementById('payment-total');
        var totalDisplayEl = document.getElementById('payment-total-display');

        if (!listEl) return;

        listEl.innerHTML = '';

        if (cartItems.length === 0) {
            listEl.innerHTML = '<p class="checkout-item-detail" style="text-align:center;padding:20px 0;">No items in order.</p>';
        } else {
            cartItems.forEach(function (item, index) {
                var itemRow = document.createElement('div');
                itemRow.className = 'checkout-item-row';

                itemRow.innerHTML =
                    '<div class="checkout-item-img-wrapper">' +
                        '<img src="' + item.image + '" alt="' + item.name + '" class="checkout-item-img" ' +
                            'onerror="this.onerror=null; this.style.display=\'none\';">' +
                    '</div>' +
                    '<div class="checkout-item-info">' +
                        '<h4 class="checkout-item-name">' + item.name + '</h4>' +
                        '<span class="checkout-item-detail">SIZE: ' + item.size + '</span>' +
                        '<span class="checkout-item-qty">QTY: ' + item.quantity + '</span>' +
                    '</div>' +
                    '<span class="checkout-item-price">' + formatPrice(item.price * item.quantity) + '</span>';

                listEl.appendChild(itemRow);

                if (index < cartItems.length - 1) {
                    var divider = document.createElement('hr');
                    divider.className = 'checkout-items-divider';
                    listEl.appendChild(divider);
                }
            });
        }

        var subtotal = getSubtotal();
        var total = getTotal();

        if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
        if (shippingEl) shippingEl.textContent = formatPrice(SHIPPING_COST);
        if (totalEl) totalEl.textContent = formatPrice(total);
        if (totalDisplayEl) totalDisplayEl.textContent = formatPrice(total);
    }

    // ─── File Validation ───────────────────────────────────────────────────────
    // CLIENT-SIDE ONLY — the backend must independently validate type, size, and
    // file content (magic bytes) before storing or processing the upload.
    function validateFile(file) {
        if (!file) return { valid: false, error: 'No file selected.' };

        if (ALLOWED_TYPES.indexOf(file.type) === -1) {
            return {
                valid: false,
                error: 'Invalid file type. Please upload a JPEG, PNG, or WEBP image.'
            };
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
            return {
                valid: false,
                error: 'File too large. Maximum allowed size is 5MB.'
            };
        }

        return { valid: true, error: null };
    }

    // ─── Show / hide error message ─────────────────────────────────────────────
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

        // Show preview
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

        // Enable confirm button
        var confirmBtn = document.getElementById('confirm-payment-btn');
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.setAttribute('aria-disabled', 'false');
        }
    }

    // ─── Clear selected file: reset to default state ──────────────────────────
    function clearFile() {
        uploadedFile = null;

        var previewImg = document.getElementById('upload-preview-img');
        var defaultState = document.getElementById('upload-default-state');
        var previewState = document.getElementById('upload-preview-state');
        var fileInput = document.getElementById('payment-proof-input');

        if (previewImg) previewImg.src = '';
        if (defaultState) defaultState.style.display = 'flex';
        if (previewState) previewState.style.display = 'none';

        // Reset file input so the same file can be re-selected
        if (fileInput) fileInput.value = '';

        // Disable confirm button
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

        // File input change (click-to-upload path)
        fileInput.addEventListener('change', function () {
            if (this.files && this.files[0]) {
                applyFile(this.files[0]);
            }
        });

        // Keyboard accessibility: Enter/Space on dropzone triggers file input
        dropzone.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInput.click();
            }
        });

        // Drag-and-drop events on the dropzone
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
            if (files && files[0]) {
                applyFile(files[0]);
            }
        });

        // Remove button
        if (removeBtn) {
            removeBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation(); // prevent click from falling through to file input
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
            if (!uploadedFile) return; // guard — should not happen if button is disabled

            // Build a FormData payload ready for the backend endpoint.
            // In production, POST this to /api/orders/{orderId}/payment-proof
            // The server must:
            //   - Verify the session/token matches the orderId
            //   - Re-validate the file (type, size, magic bytes)
            //   - Store the file securely (e.g., in a private cloud bucket)
            //   - Set the order status to "pending_verification" — NOT "paid"
            var formData = new FormData();
            formData.append('paymentProof', uploadedFile, uploadedFile.name);
            // The order ID comes from the backend — never trust a client-supplied value
            if (orderId) {
                formData.append('orderId', orderId);
            }

            // Disable button and show pending state while request is in flight
            this.disabled = true;
            this.setAttribute('aria-disabled', 'true');
            this.textContent = 'SUBMITTING…';

            // TODO: replace with actual fetch() call once backend endpoint is ready
            // Example:
            // fetch('/api/orders/' + orderId + '/payment-proof', {
            //     method: 'POST',
            //     body: formData,
            //     credentials: 'include' // send session cookie
            // })
            // .then(function(res) { if (!res.ok) throw new Error('Upload failed'); return res.json(); })
            // .then(function(data) { showSuccessState(data); })
            // .catch(function(err) { showError('Upload failed. Please try again.'); });

            // Demo mode: simulate a successful submission after a short delay
            setTimeout(function () {
                showSuccessState();
            }, 1200);
        });
    }

    // ─── Success State (post-submission) ──────────────────────────────────────
    function showSuccessState() {
        var main = document.querySelector('.payment-container');
        if (!main) return;

        main.outerHTML =
            '<div class="success-container">' +
                '<div class="success-icon">✓</div>' +
                '<h2 class="success-title">PAYMENT PROOF SUBMITTED</h2>' +
                '<p class="success-message">' +
                    'Thank you! Your payment proof has been received and is now ' +
                    '<strong>pending verification</strong> by our team. ' +
                    'We will notify you once your payment has been confirmed.' +
                '</p>' +
                '<a href="index.html" class="success-back-btn">RETURN TO HOME</a>' +
            '</div>';
    }

    // ─── Init ──────────────────────────────────────────────────────────────────
    renderOrderSummary();
    bindUploadEvents();
    bindConfirmButton();

})();
