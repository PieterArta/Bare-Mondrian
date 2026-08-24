// cart.js — Cart Drawer Logic for BARE MONDRIAN
console.log("BARE MONDRIAN: cart.js loaded successfully!");

// 1. Cart State with LocalStorage persistence
let defaultCartItems = [
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

let cartItems = [];
try {
    let saved = localStorage.getItem('bare_mondrian_cart');
    if (saved) {
        cartItems = JSON.parse(saved);
    } else {
        cartItems = defaultCartItems;
        localStorage.setItem('bare_mondrian_cart', JSON.stringify(cartItems));
    }
} catch (e) {
    cartItems = defaultCartItems;
}

function saveCart() {
    try {
        localStorage.setItem('bare_mondrian_cart', JSON.stringify(cartItems));
    } catch (e) {
        console.error("Failed to save cart to localStorage", e);
    }
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
    saveCart();
    var itemsList = document.getElementById('cart-items-list');
    var subtotalEl = document.getElementById('cart-subtotal');
    var totalEl = document.getElementById('cart-total');

    if (!itemsList) return;

    itemsList.innerHTML = '';

    if (cartItems.length === 0) {
        itemsList.innerHTML =
            '<div class="cart-empty-state">' +
            '<div class="cart-empty-title">Your Cart is Empty</div>' +
            '<div class="cart-empty-text">Add some structural streetwear to get started.</div>' +
            '<a href="shop.html" class="cart-empty-shop-btn" id="cart-continue-shopping">CONTINUE SHOPPING</a>' +
            '</div>';
        subtotalEl.textContent = formatPrice(0);
        totalEl.textContent = formatPrice(0);
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
            '<span class="cart-item-size">SIZE: ' + item.size + '</span>' +
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
    subtotalEl.textContent = formatPrice(subtotal);
    totalEl.textContent = formatPrice(subtotal);

    // Bind stepper and remove buttons
    itemsList.querySelectorAll('.minus-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var idx = parseInt(this.getAttribute('data-index'));
            if (cartItems[idx].quantity > 1) {
                cartItems[idx].quantity--;
                renderCart();
            }
        });
    });

    itemsList.querySelectorAll('.plus-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var idx = parseInt(this.getAttribute('data-index'));
            cartItems[idx].quantity++;
            renderCart();
        });
    });

    itemsList.querySelectorAll('.cart-item-remove-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var idx = parseInt(this.getAttribute('data-index'));
            cartItems.splice(idx, 1);
            renderCart();
        });
    });
}

// 4. Open / Close the drawer
function openCart() {
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

// Expose globally so onclick="" attributes and DevTools can call them
window.openCart = openCart;
window.closeCart = closeCart;

// Check for openCart parameter in URL
if (window.location.search.indexOf('openCart=true') !== -1) {
    // Wait a brief moment for DOM render/transitions to stabilize
    setTimeout(openCart, 100);
}

