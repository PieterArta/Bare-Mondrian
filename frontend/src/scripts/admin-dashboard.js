/* admin-dashboard.js — BARE MONDRIAN Admin Dashboard */

'use strict';

var API_BASE_URL = 'https://bare-mondrian.onrender.com';

/* -------------------------------------------------------
   AUTH GUARD
   ------------------------------------------------------- */
function guardAdmin() {
    if (typeof window.isLoggedIn === 'function' && typeof window.getUserRole === 'function') {
        if (!window.isLoggedIn() || window.getUserRole() !== 'admin') {
            window.location.href = '../pages/login';
            return false;
        }
        return true;
    }
    var token = localStorage.getItem('token');
    var role = localStorage.getItem('role');
    if (!token || role !== 'admin') {
        window.location.href = '../pages/login';
        return false;
    }
    return true;
}

function getAuthHeaders() {
    var token = localStorage.getItem('token');
    var h = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = 'Bearer ' + token;
    return h;
}

/* -------------------------------------------------------
   HELPERS
   ------------------------------------------------------- */
function formatPrice(n) {
    return 'Rp' + Number(n || 0).toLocaleString('id-ID');
}

function getDisplayId(id) {
    if (!id && id !== 0) return '';
    var str = String(id);
    return str.toUpperCase().indexOf('ORD-') === 0 ? str : 'ORD-' + str;
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function getInitials(name) {
    if (!name) return 'CU';
    var parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getRelativeTime(dateStr) {
    if (!dateStr) return '';
    var date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';

    var now = new Date();
    var diffMs = now - date;
    var diffSec = Math.floor(diffMs / 1000);
    var diffMin = Math.floor(diffSec / 60);
    var diffHour = Math.floor(diffMin / 60);
    var diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'JUST NOW';
    if (diffMin < 60) return diffMin + (diffMin === 1 ? ' MIN AGO' : ' MINS AGO');
    if (diffHour < 24) return diffHour + (diffHour === 1 ? ' HOUR AGO' : ' HOURS AGO');
    if (diffDay < 7) return diffDay + (diffDay === 1 ? ' DAY AGO' : ' DAYS AGO');

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
    } catch (e) {
        return dateStr;
    }
}

function calculateTotal(order) {
    if (order.total !== undefined && typeof order.total === 'number') {
        return order.total;
    }
    if (Array.isArray(order.items)) {
        return order.items.reduce(function (sum, item) {
            return sum + ((Number(item.unit_price) || 0) * (Number(item.quantity) || 1));
        }, 0);
    }
    return 0;
}

function formatProducts(order) {
    if (order.product) return order.product;
    if (Array.isArray(order.items) && order.items.length > 0) {
        return order.items.map(function (item) {
            var details = [];
            if (item.size) details.push(item.size);
            if (item.color) details.push(item.color);
            var meta = details.length ? ' (' + details.join('/') + ')' : '';
            return item.quantity + 'x Product #' + item.product_id + meta;
        }).join(', ');
    }
    return '—';
}

/* -------------------------------------------------------
   SUMMARY CARDS RENDER
   ------------------------------------------------------- */
function renderSummaryCards(orders, products) {
    var now = new Date();

    // 1. Today's orders
    var todaysOrdersCount = orders.filter(function (o) {
        if (!o.created_at) return false;
        var d = new Date(o.created_at);
        return d.getFullYear() === now.getFullYear() &&
            d.getMonth() === now.getMonth() &&
            d.getDate() === now.getDate();
    }).length;

    var elToday = document.querySelector('#card-todays-orders .summary-card-value');
    if (elToday) elToday.textContent = todaysOrdersCount;

    // 2. Pending Approval
    var pendingCount = orders.filter(function (o) {
        return (o.status || '').toLowerCase() === 'pending';
    }).length;

    var elPending = document.querySelector('#card-pending-approval .summary-card-value');
    if (elPending) elPending.textContent = pendingCount;

    // 3. Active Products
    var activeProductsCount = products.length;
    var elActive = document.querySelector('#card-active-products .summary-card-value');
    if (elActive) elActive.textContent = activeProductsCount;

    // 4. Low Stock (stock 1 - 5)
    var lowStockCount = products.filter(function (p) {
        var s = Number(p.stock) || 0;
        return s >= 1 && s <= 5;
    }).length;

    var elLowStock = document.querySelector('#card-low-stock .summary-card-value');
    if (elLowStock) elLowStock.textContent = lowStockCount;

    // 5. Revenue This Month (approved orders in current month)
    var monthlyRevenue = orders.reduce(function (sum, o) {
        if ((o.status || '').toLowerCase() !== 'approved') return sum;
        if (!o.created_at) return sum;
        var d = new Date(o.created_at);
        if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
            return sum + calculateTotal(o);
        }
        return sum;
    }, 0);

    var elRevenue = document.querySelector('#card-revenue .summary-card-value');
    if (elRevenue) {
        elRevenue.innerHTML = 'Rp<br>' + Number(monthlyRevenue).toLocaleString('id-ID');
    }
}

/* -------------------------------------------------------
   PENDING APPROVALS RENDER
   ------------------------------------------------------- */
function renderPendingApprovals(orders) {
    var card = document.getElementById('card-pending-approvals');
    if (!card) return;

    var pendingOrders = orders.filter(function (o) {
        return (o.status || '').toLowerCase() === 'pending';
    }).sort(function (a, b) {
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    }).slice(0, 3);

    var headerHtml =
        '<div class="dashboard-card-header">' +
        '<h2 class="dashboard-card-title">PENDING APPROVALS</h2>' +
        '<a href="orders" class="dashboard-card-link" id="link-view-all-pending">VIEW ALL</a>' +
        '</div>';

    if (pendingOrders.length === 0) {
        card.innerHTML = headerHtml +
            '<div style="padding:40px 24px;text-align:center;font-size:0.75rem;letter-spacing:0.1em;text-transform:uppercase;color:#888;">' +
            'NO PENDING APPROVALS' +
            '</div>';
        return;
    }

    var rowsHtml = pendingOrders.map(function (order, idx) {
        var customerName = order.recipient_name || order.customer || 'Customer';
        var initials = getInitials(customerName);
        var displayId = getDisplayId(order.id);
        var relTime = getRelativeTime(order.created_at);
        var metaText = 'Order #' + displayId + (relTime ? ' • ' + relTime : '');
        var totalFormatted = formatPrice(calculateTotal(order));

        var rowContent =
            '<div class="approval-row" id="approval-row-' + (idx + 1) + '">' +
            '<div class="approval-avatar-wrapper">' +
            '<div class="approval-avatar-placeholder" style="display:flex;">' + escapeHtml(initials) + '</div>' +
            '</div>' +
            '<div class="approval-info">' +
            '<span class="approval-customer-name">' + escapeHtml(customerName) + '</span>' +
            '<span class="approval-meta">' + escapeHtml(metaText) + '</span>' +
            '</div>' +
            '<div class="approval-status-block">' +
            '<span class="approval-amount">' + escapeHtml(totalFormatted) + '</span>' +
            '<span class="approval-status-label">AWAITING</span>' +
            '</div>' +
            '</div>';

        return idx < pendingOrders.length - 1
            ? rowContent + '<hr class="dashboard-divider">'
            : rowContent;
    }).join('');

    card.innerHTML = headerHtml + rowsHtml;
}

/* -------------------------------------------------------
   LOW STOCK ALERTS RENDER
   ------------------------------------------------------- */
function renderLowStockAlerts(products) {
    var card = document.getElementById('card-low-stock-alerts');
    if (!card) return;

    var lowStockProducts = products.filter(function (p) {
        return (Number(p.stock) || 0) <= 5;
    }).sort(function (a, b) {
        return (Number(a.stock) || 0) - (Number(b.stock) || 0);
    }).slice(0, 3);

    var headerHtml =
        '<div class="dashboard-card-header">' +
        '<h2 class="dashboard-card-title">LOW STOCK ALERTS</h2>' +
        '<a href="products" class="dashboard-card-link" id="link-view-all-stock">VIEW ALL</a>' +
        '</div>';

    if (lowStockProducts.length === 0) {
        card.innerHTML = headerHtml +
            '<div style="padding:40px 24px;text-align:center;font-size:0.75rem;letter-spacing:0.1em;text-transform:uppercase;color:#888;">' +
            'NO LOW STOCK ALERTS' +
            '</div>';
        return;
    }

    var rowsHtml = lowStockProducts.map(function (product, idx) {
        var name = product.title || product.name || 'Product';
        var stock = Number(product.stock) || 0;
        var sku = product.sku ? ('SKU: ' + product.sku) : ('ID: #' + product.id);
        var imgSrc = product.image_url || '';
        var isCritical = (stock <= 2);
        var badgeText = isCritical ? 'CRITICAL' : 'WARNING';
        var badgeClass = isCritical ? 'stock-badge--critical' : 'stock-badge--warning';
        var countClass = isCritical ? 'stock-count--critical' : '';

        var imageHtml = imgSrc
            ? '<img src="' + escapeHtml(imgSrc) + '" alt="' + escapeHtml(name) + '" class="stock-img" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">' +
            '<div class="stock-img-placeholder" style="display:none;"></div>'
            : '<div class="stock-img-placeholder"></div>';

        var rowContent =
            '<div class="stock-row" id="stock-row-' + (idx + 1) + '">' +
            '<div class="stock-img-wrapper">' + imageHtml + '</div>' +
            '<div class="stock-info">' +
            '<span class="stock-product-name">' + escapeHtml(name) + '</span>' +
            '<span class="stock-sku">' + escapeHtml(sku) + '</span>' +
            '</div>' +
            '<div class="stock-status-block">' +
            '<span class="stock-count ' + countClass + '">' + stock + ' LEFT</span>' +
            '<span class="stock-badge ' + badgeClass + '">' + badgeText + '</span>' +
            '</div>' +
            '</div>';

        return idx < lowStockProducts.length - 1
            ? rowContent + '<hr class="dashboard-divider">'
            : rowContent;
    }).join('');

    card.innerHTML = headerHtml + rowsHtml;
}

/* -------------------------------------------------------
   RECENT ACTIVITY RENDER
   ------------------------------------------------------- */
function renderRecentActivity(orders) {
    var tbody = document.querySelector('#recent-activity-table tbody');
    if (!tbody) return;

    var recentOrders = orders.slice().sort(function (a, b) {
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    }).slice(0, 5);

    if (recentOrders.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="6" style="text-align:center;padding:32px 0;font-size:0.75rem;letter-spacing:0.1em;color:#888;">' +
            'NO RECENT ACTIVITY' +
            '</td></tr>';
        return;
    }

    var html = recentOrders.map(function (order, idx) {
        var displayId = getDisplayId(order.id);
        var customer = escapeHtml(order.recipient_name || order.customer || '—');
        var products = escapeHtml(formatProducts(order));
        var total = escapeHtml(formatPrice(calculateTotal(order)));
        var status = (order.status || 'pending').toLowerCase();
        var badgeCls = (status === 'approved') ? 'status-badge--approved' : 'status-badge--pending';
        var dateStr = escapeHtml(formatDate(order.created_at || order.date));
        var isLast = (idx === recentOrders.length - 1);

        return (
            '<tr class="recent-table-row' + (isLast ? ' recent-table-row--last' : '') + '" id="row-ord-' + order.id + '">' +
            '<td class="recent-td recent-td--order-id">#' + displayId + '</td>' +
            '<td class="recent-td recent-td--customer">' + customer + '</td>' +
            '<td class="recent-td recent-td--product">' + products + '</td>' +
            '<td class="recent-td recent-td--total">' + total + '</td>' +
            '<td class="recent-td">' +
            '<span class="status-badge ' + badgeCls + '">' + escapeHtml(status.toUpperCase()) + '</span>' +
            '</td>' +
            '<td class="recent-td recent-td--date">' + dateStr + '</td>' +
            '</tr>'
        );
    }).join('');

    tbody.innerHTML = html;
}

/* -------------------------------------------------------
   FETCH DATA FROM API
   ------------------------------------------------------- */
function loadDashboardData() {
    var ordersPromise = fetch(API_BASE_URL + '/api/orders/', {
        method: 'GET',
        headers: getAuthHeaders()
    }).then(function (res) {
        if (!res.ok) throw new Error('Failed to fetch orders (status ' + res.status + ')');
        return res.json();
    }).catch(function (err) {
        console.error('[Dashboard] Orders fetch error:', err);
        return [];
    });

    var productsPromise = fetch(API_BASE_URL + '/api/products/', {
        method: 'GET',
        headers: getAuthHeaders()
    }).then(function (res) {
        if (!res.ok) throw new Error('Failed to fetch products (status ' + res.status + ')');
        return res.json();
    }).catch(function (err) {
        console.error('[Dashboard] Products fetch error:', err);
        return [];
    });

    Promise.all([ordersPromise, productsPromise])
        .then(function (results) {
            var orders = Array.isArray(results[0]) ? results[0] : [];
            var productsData = results[1];
            var products = Array.isArray(productsData) ? productsData : (productsData.products || productsData.items || []);

            renderSummaryCards(orders, products);
            renderPendingApprovals(orders);
            renderLowStockAlerts(products);
            renderRecentActivity(orders);
        })
        .catch(function (err) {
            console.error('[Dashboard] Unexpected render error:', err);
        });
}

/* -------------------------------------------------------
   SIDEBAR TOGGLE
   ------------------------------------------------------- */
function initSidebarToggle() {
    var hamburgerBtn = document.getElementById('admin-hamburger-btn');
    var sidebar = document.getElementById('admin-sidebar');
    var overlay = document.getElementById('admin-sidebar-overlay');

    if (hamburgerBtn && sidebar && overlay) {
        hamburgerBtn.addEventListener('click', function () {
            sidebar.classList.add('active');
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        });

        overlay.addEventListener('click', function () {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        });
    }
}

/* -------------------------------------------------------
   BOOT
   ------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', function () {
    if (!guardAdmin()) return;
    initSidebarToggle();
    loadDashboardData();
});
