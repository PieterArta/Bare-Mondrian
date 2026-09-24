// checkout.js — Form Logic, Order Summary rendering, and API integration for BARE MONDRIAN

(function () {
    'use strict';

    var API_BASE_URL = 'https://bare-mondrian.onrender.com';

    // ─── Shipping State ──────────────────────────────────────────────────────
    var currentShippingCost = 0;
    var currentShippingEtd = '';
    var currentShippingService = 'JNE REG';
    var currentCourier = 'jne';
    var currentProvinceId = '';
    var currentProvinceName = '';
    var currentCityId = '';
    var currentCityName = '';

    // ─── 1. Retrieve cart items ─────────────────────────────────────────────
    function fetchCartItems() {
        if (typeof window.getCartItems === 'function') {
            return window.getCartItems();
        }
        try {
            var saved = localStorage.getItem('bare_mondrian_cart');
            if (saved !== null && saved !== undefined && String(saved).trim() !== '') {
                var parsed = JSON.parse(saved);
                return Array.isArray(parsed) ? parsed : [];
            }
            return [];
        } catch (e) {
            return [];
        }
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    /** Format price in IDR format: "Rp180.000" */
    function formatPrice(amount) {
        var num = Math.round(Number(amount));
        return 'Rp' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    /** Format ETD string: e.g. "2 day" -> "2 days", "2" -> "2 days", "1-2 HARI" -> "1-2 HARI" */
    function formatEtd(etdStr) {
        if (!etdStr) return '';
        var s = String(etdStr).trim();
        if (s.toLowerCase() === '1 day') return '1 day';
        s = s.replace(/\bday\b/gi, 'days');
        if (s.toLowerCase().includes('days') || s.toLowerCase().includes('hari')) {
            return s;
        }
        return s + (s === '1' ? ' day' : ' days');
    }

    /** Calculate cart subtotal */
    function getSubtotal(cartItems) {
        return cartItems.reduce(function (sum, item) {
            return sum + (Number(item.price) || 0) * (Number(item.quantity) || 1);
        }, 0);
    }

    function escapeAttr(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function showError(message) {
        var errorEl = document.getElementById('checkout-form-error');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        } else {
            alert(message);
        }
    }

    function clearError() {
        var errorEl = document.getElementById('checkout-form-error');
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.style.display = 'none';
        }
    }

    // ─── 2. Render Order Summary ───────────────────────────────────────────
    function renderOrderSummary() {
        var listContainer = document.getElementById('checkout-items-list');

        if (!listContainer) return;

        var cartItems = fetchCartItems();
        listContainer.innerHTML = '';

        if (!cartItems || cartItems.length === 0) {
            listContainer.innerHTML =
                '<p class="checkout-item-detail" style="text-align: center; padding: 24px 0; color: #888;">' +
                'YOUR CART IS EMPTY.' +
                '</p>';
            updateTotalsDisplay();
            return;
        }

        cartItems.forEach(function (item, index) {
            var itemRow = document.createElement('div');
            itemRow.className = 'checkout-item-row';

            var itemImgSrc = item.image || 'assets/images/products/produk3.jpg';
            var itemTotal = (Number(item.price) || 0) * (Number(item.quantity) || 1);

            itemRow.innerHTML =
                '<div class="checkout-item-img-wrapper">' +
                '<img src="' + itemImgSrc + '" alt="' + (item.name || 'Product') + '" class="checkout-item-img" onerror="this.style.display=\'none\';">' +
                '</div>' +
                '<div class="checkout-item-info">' +
                '<h4 class="checkout-item-name">' + String(item.name || '').toUpperCase() + '</h4>' +
                '<span class="checkout-item-detail">SIZE: ' + String(item.size || 'FREE SIZE').toUpperCase() + '</span>' +
                '<span class="checkout-item-qty">QTY: ' + (item.quantity || 1) + '</span>' +
                '</div>' +
                '<span class="checkout-item-price">' + formatPrice(itemTotal) + '</span>';

            listContainer.appendChild(itemRow);

            if (index < cartItems.length - 1) {
                var divider = document.createElement('hr');
                divider.className = 'checkout-items-divider';
                listContainer.appendChild(divider);
            }
        });

        updateTotalsDisplay();
    }

    function updateTotalsDisplay() {
        var cartItems = fetchCartItems();
        var subtotal = getSubtotal(cartItems);
        var subtotalEl = document.getElementById('checkout-subtotal');
        var shippingEl = document.getElementById('checkout-shipping');
        var totalEl = document.getElementById('checkout-total');

        if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);

        if (shippingEl) {
            if (currentShippingCost > 0) {
                shippingEl.textContent = formatPrice(currentShippingCost);
            } else if (!currentCityId) {
                shippingEl.textContent = 'SELECT DESTINATION';
            } else {
                shippingEl.textContent = 'COMPLIMENTARY';
            }
        }

        var total = subtotal + (currentShippingCost || 0);
        if (totalEl) totalEl.textContent = formatPrice(total);
    }

    // ─── 3. RajaOngkir Shipping Dropdowns & Cost API ───────────────────────
    function initRajaOngkirShipping() {
        var provinceSelect = document.getElementById('province');
        var citySelect = document.getElementById('city');
        var shippingEl = document.getElementById('checkout-shipping');

        if (!provinceSelect || !citySelect) return;

        // A. Populate Provinces
        provinceSelect.innerHTML = '<option value="" disabled selected>LOADING PROVINCES...</option>';

        fetch(API_BASE_URL + '/api/shipping/provinces')
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (provinces) {
                var sortedProvinces = (provinces || []).slice().sort(function (a, b) {
                    return (a.name || '').localeCompare(b.name || '');
                });
                var html = '<option value="" disabled selected>Select Province</option>';
                sortedProvinces.forEach(function (p) {
                    html += '<option value="' + p.id + '" data-name="' + escapeAttr(p.name) + '">' + escapeAttr(p.name.toUpperCase()) + '</option>';
                });
                provinceSelect.innerHTML = html;
            })
            .catch(function (err) {
                console.error('[Shipping] Failed to load provinces:', err);
                provinceSelect.innerHTML = '<option value="" disabled selected>SELECT PROVINCE (ERROR)</option>';
                showError('Unable to load provinces list. Please refresh or try again.');
            });

        // B. Handle Province Change -> Fetch Cities
        provinceSelect.addEventListener('change', function () {
            clearError();
            var selectedOpt = provinceSelect.options[provinceSelect.selectedIndex];
            currentProvinceId = provinceSelect.value;
            currentProvinceName = selectedOpt ? (selectedOpt.getAttribute('data-name') || selectedOpt.text) : '';
            currentCityId = '';
            currentCityName = '';

            // Reset City dropdown
            citySelect.innerHTML = '<option value="" disabled selected>LOADING CITIES...</option>';
            citySelect.disabled = true;

            // Reset Shipping cost
            currentShippingCost = 0;
            currentShippingEtd = '';
            updateTotalsDisplay();

            if (!currentProvinceId) return;

            fetch(API_BASE_URL + '/api/shipping/cities?province_id=' + encodeURIComponent(currentProvinceId))
                .then(function (res) {
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    return res.json();
                })
                .then(function (cities) {
                    var html = '<option value="" disabled selected>Select City/Regency</option>';
                    (cities || []).forEach(function (c) {
                        html += '<option value="' + c.id + '" data-name="' + escapeAttr(c.name) + '">' + escapeAttr(c.name.toUpperCase()) + '</option>';
                    });
                    citySelect.innerHTML = html;
                    citySelect.disabled = false;
                })
                .catch(function (err) {
                    console.error('[Shipping] Failed to load cities:', err);
                    citySelect.innerHTML = '<option value="" disabled selected>SELECT CITY (ERROR)</option>';
                    citySelect.disabled = false;
                    showError('Unable to load cities for selected province.');
                });
        });

        // C. Handle City Change -> Calculate Cost
        citySelect.addEventListener('change', function () {
            clearError();
            var selectedOpt = citySelect.options[citySelect.selectedIndex];
            currentCityId = citySelect.value;
            currentCityName = selectedOpt ? (selectedOpt.getAttribute('data-name') || selectedOpt.text) : '';

            if (!currentProvinceId || !currentCityId) return;

            var cartItems = fetchCartItems();
            var totalQty = cartItems.reduce(function (sum, item) {
                return sum + (Number(item.quantity) || 1);
            }, 0);
            var weightGrams = Math.max(1000, totalQty * 1000); // 1000g per item placeholder, min 1000g

            if (shippingEl) shippingEl.textContent = 'CALCULATING...';

            fetch(API_BASE_URL + '/api/shipping/cost', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    destination_city_id: currentCityId,
                    weight_grams: weightGrams,
                    courier: 'jne'
                })
            })
                .then(function (res) {
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    return res.json();
                })
                .then(function (options) {
                    if (options && options.length > 0) {
                        var option = options[0];
                        currentShippingCost = Number(option.cost) || 0;
                        currentShippingEtd = option.etd || '';
                        var cName = (option.courier || 'jne').toUpperCase();
                        var sName = (option.service || 'REG').toUpperCase();
                        currentShippingService = cName + ' ' + sName;
                        updateTotalsDisplay();
                    } else {
                        throw new Error('No shipping rates available.');
                    }
                })
                .catch(function (err) {
                    console.error('[Shipping] Cost calculation failed:', err);
                    if (shippingEl) shippingEl.textContent = 'CALCULATION ERROR';
                    showError('Unable to calculate shipping cost, please try again.');
                });
        });
    }

    // ─── 4. Form Validation & Order Submission ────────────────────────────
    function initCheckoutForm() {
        var form = document.getElementById('shipping-form');
        var confirmBtn = document.getElementById('confirm-order-btn');
        if (!form) return;

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            clearError();

            var cartItems = fetchCartItems();
            if (!cartItems || cartItems.length === 0) {
                showError('YOUR CART IS EMPTY. PLEASE ADD PRODUCTS BEFORE CHECKING OUT.');
                return;
            }

            // Extract & sanitize form inputs
            var fullName = document.getElementById('full-name') ? document.getElementById('full-name').value.trim() : '';
            var phoneNumber = document.getElementById('phone-number') ? document.getElementById('phone-number').value.trim() : '';
            var postalCode = document.getElementById('postal-code') ? document.getElementById('postal-code').value.trim() : '';
            var completeAddress = document.getElementById('complete-address') ? document.getElementById('complete-address').value.trim() : '';

            // Validate all required fields
            if (!fullName || !phoneNumber || !currentProvinceId || !currentCityId || !postalCode || !completeAddress) {
                showError('PLEASE FILL OUT ALL REQUIRED SHIPPING FIELDS.');
                return;
            }

            // Build payload matching backend OrderCreate schema
            var payloadItems = cartItems.map(function (item) {
                var pid = parseInt(String(item.id).replace(/\D/g, '')) || 1;
                return {
                    product_id: pid,
                    quantity: Number(item.quantity) || 1,
                    size: item.rawSize || item.size || null,
                    color: item.color || null
                };
            });

            var payload = {
                shipping: {
                    recipient_name: fullName,
                    recipient_phone: phoneNumber,
                    province: currentProvinceName || 'PROVINCE',
                    city: currentCityName || 'CITY',
                    province_id: currentProvinceId,
                    city_id: currentCityId,
                    courier: currentCourier || 'jne',
                    shipping_cost: currentShippingCost || 0,
                    postal_code: postalCode,
                    address: completeAddress
                },
                items: payloadItems
            };

            // Loading state
            var originalBtnHTML = confirmBtn ? confirmBtn.innerHTML : 'CONFIRM ORDER →';
            if (confirmBtn) {
                confirmBtn.disabled = true;
                confirmBtn.textContent = 'CONFIRMING ORDER...';
            }

            // Optional Auth token
            var headers = { 'Content-Type': 'application/json' };
            var token = localStorage.getItem('token');
            if (token && token.trim() !== '') {
                headers['Authorization'] = 'Bearer ' + token.trim();
            }

            fetch(API_BASE_URL + '/api/orders/', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload)
            })
                .then(function (res) {
                    return res.json().then(function (data) {
                        return { status: res.status, ok: res.ok, data: data };
                    });
                })
                .then(function (result) {
                    if (!result.ok) {
                        var errMsg = (result.data && result.data.detail)
                            ? result.data.detail
                            : 'Failed to place order. Please try again.';
                        showError(errMsg);
                        if (confirmBtn) {
                            confirmBtn.disabled = false;
                            confirmBtn.innerHTML = originalBtnHTML;
                        }
                        return;
                    }

                    var orderData = result.data;
                    if (orderData && orderData.id) {
                        // Store current order ID for payment page
                        sessionStorage.setItem('currentOrderId', orderData.id);

                        // Clear cart state
                        if (typeof window.clearCart === 'function') {
                            window.clearCart();
                        } else {
                            localStorage.removeItem('bare_mondrian_cart');
                        }

                        // Redirect to Payment page
                        window.location.href = '/pages/payment';
                    } else {
                        showError('Order confirmation failed. Invalid response from server.');
                        if (confirmBtn) {
                            confirmBtn.disabled = false;
                            confirmBtn.innerHTML = originalBtnHTML;
                        }
                    }
                })
                .catch(function (err) {
                    console.error('[Checkout] API error:', err);
                    showError('Network error. Unable to place order right now.');
                    if (confirmBtn) {
                        confirmBtn.disabled = false;
                        confirmBtn.innerHTML = originalBtnHTML;
                    }
                });
        });
    }

    // ─── 5. Boot ─────────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', function () {
        renderOrderSummary();
        initRajaOngkirShipping();
        initCheckoutForm();
    });
})();

