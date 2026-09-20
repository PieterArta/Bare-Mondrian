// cart.js — Cart Drawer Logic for BARE MONDRIAN
console.log("BARE MONDRIAN: cart.js loaded successfully!");

// 1. Cart State with LocalStorage persistence
let cartItems = [];

function loadCart() {
    try {
        let saved = localStorage.getItem('bare_mondrian_cart');
        if (saved !== null && saved !== undefined && String(saved).trim() !== '') {
            let parsed = JSON.parse(saved);
            cartItems = Array.isArray(parsed) ? parsed : [];
        } else {
            cartItems = [];
        }
    } catch (e) {
        console.error("[Cart] Failed to load cart from localStorage", e);
        cartItems = [];
    }
    console.log("[Cart] Loaded cart items from localStorage:", cartItems);
    return cartItems;
}

function saveCart() {
    try {
        localStorage.setItem('bare_mondrian_cart', JSON.stringify(cartItems));
        console.log("[Cart] Saved cart items to localStorage:", cartItems);
    } catch (e) {
        console.error("[Cart] Failed to save cart to localStorage", e);
    }
}

// Helper: Format price as Indonesian Rupiah (e.g., Rp180.000)
function formatPrice(amount) {
    return 'Rp' + (Number(amount) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Helper: Calculate subtotal
function getSubtotal() {
    loadCart();
    return cartItems.reduce(function (sum, item) {
        return sum + (Number(item.price) || 0) * (Number(item.quantity) || 1);
    }, 0);
}

// 2. Inject Cart HTML into body (idempotent — safe to call multiple times)
function injectCartDOM() {
    if (!document.getElementById('cart-overlay')) {
        var overlay = document.createElement('div');
        overlay.className = 'cart-overlay';
        overlay.id = 'cart-overlay';
        document.body.appendChild(overlay);
    }

    if (!document.getElementById('cart-drawer')) {
        var drawer = document.createElement('div');
        drawer.className = 'cart-drawer';
        drawer.id = 'cart-drawer';
        drawer.innerHTML =
            '<div class="cart-header">' +
            '<span class="cart-title">YOUR CART</span>' +
            '<button class="cart-close-btn" id="cart-close" aria-label="Close Cart">&times;</button>' +
            '</div>' +
            '<div class="cart-items-container" id="cart-items-list"></div>' +
            '<div class="cart-summary" id="cart-summary-section">' +
            '<div class="summary-row"><span>SUBTOTAL</span><span id="cart-subtotal">Rp0</span></div>' +
            '<div class="summary-row shipping"><span>SHIPPING</span><span>CALCULATED AT CHECKOUT</span></div>' +
            '<hr class="summary-divider">' +
            '<div class="summary-row total"><span>TOTAL</span><span id="cart-total">Rp0</span></div>' +
            '<button class="checkout-btn" id="cart-checkout-btn">CHECKOUT</button>' +
            '<small class="cart-tax-note">TAX INCLUDED WHERE APPLICABLE.</small>' +
            '</div>';
        document.body.appendChild(drawer);
    }
}

// 3. Render cart items and totals
function renderCart() {
    loadCart();
    var itemsList = document.getElementById('cart-items-list');
    var subtotalEl = document.getElementById('cart-subtotal');
    var totalEl = document.getElementById('cart-total');

    if (!itemsList) return;

    itemsList.innerHTML = '';

    if (!cartItems || cartItems.length === 0) {
        itemsList.innerHTML =
            '<div class="cart-empty-state">' +
            '<div class="cart-empty-title">Your Cart is Empty</div>' +
            '<div class="cart-empty-text">Add some structural streetwear to get started.</div>' +
            '<a href="shop.html" class="cart-empty-shop-btn" id="cart-continue-shopping">CONTINUE SHOPPING</a>' +
            '</div>';
        if (subtotalEl) subtotalEl.textContent = formatPrice(0);
        if (totalEl) totalEl.textContent = formatPrice(0);
        return;
    }

    cartItems.forEach(function (item, index) {
        var card = document.createElement('div');
        card.className = 'cart-item-card';
        card.innerHTML =
            '<div class="cart-item-image-wrapper">' +
            '<img src="' + item.image + '" alt="' + item.name + '" class="cart-item-image" onerror="this.onerror=null;this.style.opacity=\'0\';">' +
            '</div>' +
            '<div class="cart-item-info">' +
            '<div class="cart-item-name-row">' +
            '<h4 class="cart-item-name">' + item.name + '</h4>' +
            '<span class="cart-item-size">SIZE: ' + (item.size || 'FREE SIZE') + '</span>' +
            '</div>' +
            '<div class="cart-item-bottom-row">' +
            '<div class="quantity-stepper">' +
            '<button class="stepper-btn minus-btn" data-index="' + index + '">&minus;</button>' +
            '<span class="stepper-value">' + item.quantity + '</span>' +
            '<button class="stepper-btn plus-btn" data-index="' + index + '">+</button>' +
            '</div>' +
            '<span class="cart-item-price">' + formatPrice(item.price * item.quantity) + '</span>' +
            '</div>' +
            '</div>' +
            '<button class="cart-item-remove-btn" data-index="' + index + '" aria-label="Remove item">&times;</button>';
        itemsList.appendChild(card);
    });

    var subtotal = getSubtotal();
    if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
    if (totalEl) totalEl.textContent = formatPrice(subtotal);

    // Bind stepper and remove buttons
    itemsList.querySelectorAll('.minus-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var idx = parseInt(this.getAttribute('data-index'));
            if (cartItems[idx] && cartItems[idx].quantity > 1) {
                cartItems[idx].quantity--;
                saveCart();
                renderCart();
            }
        });
    });

    itemsList.querySelectorAll('.plus-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var idx = parseInt(this.getAttribute('data-index'));
            if (cartItems[idx]) {
                cartItems[idx].quantity++;
                saveCart();
                renderCart();
            }
        });
    });

    itemsList.querySelectorAll('.cart-item-remove-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var idx = parseInt(this.getAttribute('data-index'));
            if (cartItems[idx] !== undefined) {
                cartItems.splice(idx, 1);
                saveCart();
                renderCart();
            }
        });
    });
}

// 4. Open / Close the drawer
function openCart() {
    renderCart();
    var overlay = document.getElementById('cart-overlay');
    var drawer = document.getElementById('cart-drawer');
    if (overlay && drawer) {
        overlay.classList.add('active');
        drawer.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeCart() {
    var overlay = document.getElementById('cart-overlay');
    var drawer = document.getElementById('cart-drawer');
    if (overlay && drawer) {
        overlay.classList.remove('active');
        drawer.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// 5. Initialise — inject HTML, render state, bind buttons
injectCartDOM();
renderCart();

var cartToggleBtn = document.getElementById('btn-cart');
var cartCloseBtn = document.getElementById('cart-close');
var cartOverlay = document.getElementById('cart-overlay');
var checkoutBtn = document.getElementById('cart-checkout-btn');

if (cartToggleBtn) {
    cartToggleBtn.addEventListener('click', function (e) {
        e.preventDefault();
        openCart();
    });
}

if (cartCloseBtn) {
    cartCloseBtn.addEventListener('click', closeCart);
}

if (cartOverlay) {
    cartOverlay.addEventListener('click', closeCart);
}

if (checkoutBtn) {
    checkoutBtn.addEventListener('click', function () {
        closeCart();
        window.location.href = 'checkout.html';
    });
}

function getCartItems() {
    return loadCart();
}

function clearCart() {
    cartItems = [];
    saveCart();
    renderCart();
}

// Expose globally so onclick="" attributes and DevTools can call them
window.openCart = openCart;
window.closeCart = closeCart;
window.getCartItems = getCartItems;
window.clearCart = clearCart;
window.getSubtotal = getSubtotal;
window.renderCart = renderCart;

// Check for openCart parameter in URL
if (window.location.search.indexOf('openCart=true') !== -1) {
    setTimeout(openCart, 100);
}
