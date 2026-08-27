// product.js — Product Detail Page and Shop Interactivity

(function () {
    // 1. Wishlist Heart Toggle (for Shop Page)
    var wishlistBtns = document.querySelectorAll('.shop-wishlist-btn');
    wishlistBtns.forEach(function (btn) {
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            btn.classList.toggle('active');
        });
    });

    // 2. Sizing Selectors & Sizing Table Sync (Product Detail)
    var sizeBtns = document.querySelectorAll('.size-toggle-btn');
    var smCells = document.querySelectorAll('.col-sm');
    var lxlCells = document.querySelectorAll('.col-lxl');

    sizeBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            var selectedSize = this.getAttribute('data-size');

            // Switch active toggle state
            sizeBtns.forEach(function (b) { b.classList.remove('active'); });
            this.classList.add('active');

            // Highlight table column in dark panel
            if (selectedSize === 'S/M') {
                smCells.forEach(function (c) { c.classList.add('active'); });
                lxlCells.forEach(function (c) { c.classList.remove('active'); });
            } else {
                smCells.forEach(function (c) { c.classList.remove('active'); });
                lxlCells.forEach(function (c) { c.classList.add('active'); });
            }
        });
    });

    // 3. Color Selector (Product Detail) — handles circular swatches in both mobile + desktop
    var swatchBtns = document.querySelectorAll('.color-swatch-btn');
    var swatchLabels = document.querySelectorAll('.color-swatch-label');

    swatchBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            var selectedColor = this.getAttribute('data-color');
            // Sync all swatch buttons with the same color across both copies
            swatchBtns.forEach(function (b) { b.classList.remove('active'); });
            document.querySelectorAll('.color-swatch-btn[data-color="' + selectedColor + '"]').forEach(function (b) {
                b.classList.add('active');
            });
            // Update all labels to match active state
            document.querySelectorAll('.color-swatch-item').forEach(function (item) {
                var itemBtn = item.querySelector('.color-swatch-btn');
                var itemLabel = item.querySelector('.color-swatch-label');
                if (itemBtn && itemLabel) {
                    if (itemBtn.classList.contains('active')) {
                        itemLabel.classList.add('active');
                    } else {
                        itemLabel.classList.remove('active');
                    }
                }
            });
        });
    });

    // Initialize label active state on load
    document.querySelectorAll('.color-swatch-item').forEach(function (item) {
        var itemBtn = item.querySelector('.color-swatch-btn');
        var itemLabel = item.querySelector('.color-swatch-label');
        if (itemBtn && itemLabel && itemBtn.classList.contains('active')) {
            itemLabel.classList.add('active');
        }
    });

    // 4. Quantity Stepper (Product Detail)
    var qtyInput = document.getElementById('detail-qty-input');
    var qtyMinusBtn = document.getElementById('detail-qty-minus');
    var qtyPlusBtn = document.getElementById('detail-qty-plus');

    if (qtyMinusBtn && qtyPlusBtn && qtyInput) {
        qtyMinusBtn.addEventListener('click', function () {
            var val = parseInt(qtyInput.value) || 1;
            if (val > 1) {
                qtyInput.value = val - 1;
            }
        });

        qtyPlusBtn.addEventListener('click', function () {
            var val = parseInt(qtyInput.value) || 1;
            qtyInput.value = val + 1;
        });
    }

    // 5. Accordion expand/collapse (Product Detail)
    var accordionHeaders = document.querySelectorAll('.accordion-header');
    accordionHeaders.forEach(function (header) {
        header.addEventListener('click', function () {
            var target = this.getAttribute('data-target');
            var content = document.getElementById('accordion-' + target);
            var chevron = this.querySelector('.chevron-icon');

            if (!content) return;

            // Close all other accordions first for clean navigation
            accordionHeaders.forEach(function (h) {
                if (h !== header) {
                    var t = h.getAttribute('data-target');
                    var c = document.getElementById('accordion-' + t);
                    var chev = h.querySelector('.chevron-icon');
                    if (c) c.style.maxHeight = null;
                    if (chev) chev.classList.remove('active');
                }
            });

            // Toggle selected accordion
            if (content.style.maxHeight) {
                content.style.maxHeight = null;
                if (chevron) chevron.classList.remove('active');
            } else {
                content.style.maxHeight = content.scrollHeight + 'px';
                if (chevron) chevron.classList.add('active');
            }
        });
    });

    // Helper: Retrieve active size/color/quantity selections
    function getSelectedProductOptions() {
        var sizeBtn = document.querySelector('.size-toggle-btn.active');
        var colorBtn = document.querySelector('.color-swatch-btn.active');
        var qtyVal = qtyInput ? parseInt(qtyInput.value) : 1;

        return {
            id: 'item-form-001',
            name: 'FORM 001 -',
            size: sizeBtn ? sizeBtn.getAttribute('data-size') : 'S/M',
            color: colorBtn ? colorBtn.getAttribute('data-color') : 'ASH GREY',
            quantity: qtyVal,
            price: 549000,
            image: 'assets/images/products/produk3.jpg'
        };
    }

    // Helper: Push item directly to shared localStorage cart state
    function addProductToCartState(product) {
        var cartItems = [];
        try {
            var saved = localStorage.getItem('bare_mondrian_cart');
            if (saved) {
                cartItems = JSON.parse(saved);
            }
        } catch (ex) {
            console.error(ex);
        }

        // Check if matching item exists (name, size, color)
        var matchedIndex = -1;
        for (var i = 0; i < cartItems.length; i++) {
            if (cartItems[i].name === product.name &&
                cartItems[i].size === product.size &&
                cartItems[i].color === product.color) {
                matchedIndex = i;
                break;
            }
        }

        if (matchedIndex !== -1) {
            cartItems[matchedIndex].quantity += product.quantity;
        } else {
            // Include composite description for summary
            product.size = product.size + ' / ' + product.color;
            cartItems.push(product);
        }

        try {
            localStorage.setItem('bare_mondrian_cart', JSON.stringify(cartItems));
            // Trigger cart drawer UI update
            if (typeof window.renderCart === 'function') {
                // If cartItems is bound inside cart.js global context
                // Reload from local storage
                window.location.reload(); 
            }
        } catch (ex) {
            console.error(ex);
        }
    }

    // 6. ADD TO CART Button Action
    var addToCartBtn = document.getElementById('btn-add-to-cart');
    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', function () {
            var product = getSelectedProductOptions();
            addProductToCartState(product);
            
            // Open the cart drawer
            if (typeof window.openCart === 'function') {
                window.openCart();
            } else {
                // Redirect back to shop with cart trigger query param
                window.location.href = 'shop.html?openCart=true';
            }
        });
    }

    // 7. BUY NOW Button Action
    var buyNowBtn = document.getElementById('btn-buy-now');
    if (buyNowBtn) {
        buyNowBtn.addEventListener('click', function () {
            var product = getSelectedProductOptions();
            addProductToCartState(product);
            // Redirect directly to checkout
            window.location.href = 'checkout.html';
        });
    }

})();
