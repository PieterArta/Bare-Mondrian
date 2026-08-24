// checkout.js — Form Logic and Order Summary rendering

(function () {
    // 1. Retrieve cart items from localStorage (fallback to defaults if empty)
    var defaultCartItems = [
        {
            id: 'item-1',
            name: 'STRUCTURAL HOODIE BLK',
            size: 'L',
            quantity: 1,
            price: 180000,
            image: 'assets/images/products/produk1.jpg'
        },
        {
            id: 'item-2',
            name: 'BRUTALIST SNEAKER WHT',
            size: '43',
            quantity: 1,
            price: 180000,
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

    // Helper: Format price as Indonesian Rupiah (e.g., Rp180.000)
    function formatPrice(amount) {
        return 'Rp' + amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    // Helper: Calculate subtotal
    function getSubtotal() {
        return cartItems.reduce(function (sum, item) {
            return sum + item.price * item.quantity;
        }, 0);
    }

    // 2. Render Order Summary Items
    function renderOrderSummary() {
        var listContainer = document.getElementById('checkout-items-list');
        var subtotalEl = document.getElementById('checkout-subtotal');
        var totalEl = document.getElementById('checkout-total');

        if (!listContainer) return;

        listContainer.innerHTML = '';

        if (cartItems.length === 0) {
            listContainer.innerHTML = '<p class="checkout-item-detail" style="text-align: center; padding: 20px 0;">No items in order.</p>';
            subtotalEl.textContent = formatPrice(0);
            totalEl.textContent = formatPrice(0);
            return;
        }

        cartItems.forEach(function (item, index) {
            var itemRow = document.createElement('div');
            itemRow.className = 'checkout-item-row';
            
            // Map to descriptive mockup filenames if not actual paths
            var descriptivePath = item.image;
            if (item.name.indexOf('HOODIE') !== -1) {
                descriptivePath = 'assets/images/products/structural-hoodie-blk.jpg';
            } else if (item.name.indexOf('SNEAKER') !== -1) {
                descriptivePath = 'assets/images/products/brutalist-sneaker-wht.jpg';
            }

            itemRow.innerHTML =
                '<div class="checkout-item-img-wrapper">' +
                    // Src uses the descriptive placeholder path per user rule, falls back to actual placeholder image
                    '<img src="' + descriptivePath + '" alt="' + item.name + '" class="checkout-item-img" onerror="this.onerror=null; this.src=\'' + item.image + '\';">' +
                '</div>' +
                '<div class="checkout-item-info">' +
                    '<h4 class="checkout-item-name">' + item.name + '</h4>' +
                    '<span class="checkout-item-detail">SIZE: ' + item.size + '</span>' +
                    '<span class="checkout-item-qty">QTY: ' + item.quantity + '</span>' +
                '</div>' +
                '<span class="checkout-item-price">' + formatPrice(item.price * item.quantity) + '</span>';

            listContainer.appendChild(itemRow);

            // Add thin divider between items
            if (index < cartItems.length - 1) {
                var divider = document.createElement('hr');
                divider.className = 'checkout-items-divider';
                listContainer.appendChild(divider);
            }
        });

        var subtotal = getSubtotal();
        subtotalEl.textContent = formatPrice(subtotal);
        totalEl.textContent = formatPrice(subtotal);
    }

    // 3. Form Validation and Confirm Order
    var form = document.getElementById('shipping-form');
    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();

            // Validate all fields manually to ensure correctness
            var fullName = document.getElementById('full-name').value.trim();
            var phoneNumber = document.getElementById('phone-number').value.trim();
            var province = document.getElementById('province').value;
            var city = document.getElementById('city').value;
            var district = document.getElementById('district').value;
            var postalCode = document.getElementById('postal-code').value.trim();
            var completeAddress = document.getElementById('complete-address').value.trim();

            if (!fullName || !phoneNumber || !province || !city || !district || !postalCode || !completeAddress) {
                alert("Please fill out all shipping fields.");
                return;
            }

            // Clear the cart on successful order confirmation
            try {
                localStorage.removeItem('bare_mondrian_cart');
                // Trigger cart.js listener refresh if loaded
                if (typeof window.renderCart === 'function') {
                    window.cartItems = [];
                    window.renderCart();
                }
            } catch (ex) {
                console.error(ex);
            }

            // Render Success View
            var checkoutMain = document.querySelector('.checkout-container');
            if (checkoutMain) {
                checkoutMain.outerHTML =
                    '<div class="success-container">' +
                        '<div class="success-icon">✓</div>' +
                        '<h2 class="success-title">ORDER CONFIRMED</h2>' +
                        '<p class="success-message">' +
                            'Thank you for shopping at BARE MONDRIAN. We have received your shipping information for ' +
                            '<strong>' + fullName + '</strong>. Your order totals <strong>' + formatPrice(getSubtotal()) + '</strong> ' +
                            'and is currently being prepared for dispatch.' +
                        '</p>' +
                        '<a href="index.html" class="success-back-btn">RETURN TO HOME</a>' +
                    '</div>';
            }
        });
    }

    // Initialize Page
    renderOrderSummary();
})();
