/**
 * product-list.js — BARE MONDRIAN Admin
 * Product Management list page: auth guard, fetch from API, render table,
 * delete with confirm, edit navigation.
 */
'use strict';

var API_BASE_URL = 'https://bare-mondrian.onrender.com';

/* -------------------------------------------------------
   AUTH GUARD
   ------------------------------------------------------- */
function guardAdmin() {
    if (typeof window.isLoggedIn === 'function' && typeof window.getUserRole === 'function') {
        if (!window.isLoggedIn() || window.getUserRole() !== 'admin') {
            window.location.href = '../pages/login.html';
            return false;
        }
        return true;
    }
    // Fallback: check localStorage directly if auth.js helpers unavailable yet
    var token = localStorage.getItem('token');
    var role   = localStorage.getItem('role');
    if (!token || role !== 'admin') {
        window.location.href = '../pages/login.html';
        return false;
    }
    return true;
}

/* -------------------------------------------------------
   DOM REFERENCES
   ------------------------------------------------------- */
var tbody      = document.getElementById('pm-tbody');
var emptyState = document.getElementById('pm-empty-state');

/* -------------------------------------------------------
   HELPERS
   ------------------------------------------------------- */
function getAuthHeaders() {
    var token = localStorage.getItem('token');
    var h = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = 'Bearer ' + token;
    return h;
}

function formatPrice(n) {
    return 'Rp' + Number(n).toLocaleString('id-ID');
}

function getStockStatus(stock) {
    var qty = Number(stock);
    if (qty <= 0) return { label: 'OUT OF STOCK', cls: 'pm-stock-badge--out' };
    if (qty <= 5)  return { label: 'LOW STOCK',   cls: 'pm-stock-badge--low' };
    return              { label: 'IN STOCK',    cls: 'pm-stock-badge--in'  };
}

function buildStockBadge(stock) {
    var s = getStockStatus(stock);
    return '<span class="pm-stock-badge ' + s.cls + '">' + s.label + '</span>';
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function buildRow(product) {
    console.log('[ProductList] Building row for product:', product);
    var imgSrc = product.image_url || '';
    var name   = escapeHtml(product.title || product.name || '');
    var cat    = escapeHtml(product.category || '—');
    var id     = (product && product.id !== undefined && product.id !== null) ? product.id : (product && product._id !== undefined ? product._id : '');

    return (
        '<tr class="pm-tr" data-id="' + id + '">' +
            '<td class="pm-td pm-td--image">' +
                '<div class="pm-thumb-wrapper">' +
                    (imgSrc
                        ? '<img src="' + escapeHtml(imgSrc) + '" alt="' + name + '" class="pm-thumb-img"' +
                          ' onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">' +
                          '<div class="pm-thumb-placeholder" style="display:none;"></div>'
                        : '<div class="pm-thumb-placeholder"></div>'
                    ) +
                '</div>' +
            '</td>' +
            '<td class="pm-td pm-td--name">' + name + '</td>' +
            '<td class="pm-td pm-td--category">' + cat + '</td>' +
            '<td class="pm-td pm-td--price">' + formatPrice(product.price) + '</td>' +
            '<td class="pm-td pm-td--stock">' + buildStockBadge(product.stock) + '</td>' +
            '<td class="pm-td pm-td--actions">' +
                '<div class="pm-actions-group">' +
                    '<a href="/admin/edit-product?id=' + encodeURIComponent(id) + '" class="pm-action-btn" data-action="edit" data-id="' + id + '" data-name="' + name + '" aria-label="Edit ' + name + '" title="Edit">' +
                        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
                    '</a>' +
                    '<button class="pm-action-btn pm-action-btn--delete" data-action="delete" data-id="' + id + '" data-name="' + name + '" aria-label="Delete ' + name + '" title="Delete">' +
                        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>' +
                    '</button>' +
                '</div>' +
            '</td>' +
        '</tr>'
    );
}

/* -------------------------------------------------------
   TOAST / STATUS MESSAGE
   ------------------------------------------------------- */
var toastTimer = null;

function showToast(message, isError) {
    var toast = document.getElementById('pm-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'pm-toast';
        toast.style.cssText =
            'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);' +
            'padding:12px 24px;font-family:var(--font-sans,sans-serif);font-size:0.75rem;' +
            'font-weight:700;letter-spacing:0.08em;text-transform:uppercase;' +
            'border-radius:0;z-index:9999;transition:opacity 0.3s ease;pointer-events:none;';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.backgroundColor = isError ? '#c0392b' : '#1a1a1a';
    toast.style.color = '#fff';
    toast.style.opacity = '1';

    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
        toast.style.opacity = '0';
    }, 3000);
}

/* -------------------------------------------------------
   LOADING STATE
   ------------------------------------------------------- */
function showLoading() {
    if (!tbody) return;
    tbody.innerHTML =
        '<tr>' +
        '<td colspan="6" style="text-align:center;padding:40px 0;font-size:0.75rem;' +
        'letter-spacing:0.15em;text-transform:uppercase;color:#999;">' +
        'LOADING PRODUCTS…' +
        '</td></tr>';
    if (emptyState) emptyState.style.display = 'none';
}

/* -------------------------------------------------------
   RENDER
   ------------------------------------------------------- */
var allProducts = [];

function renderTable(products) {
    allProducts = products;
    if (!tbody) return;

    if (!products || products.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.style.display = 'flex';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    tbody.innerHTML = products.map(buildRow).join('');
    bindRowActions();
}

/* -------------------------------------------------------
   ROW ACTIONS
   ------------------------------------------------------- */
function bindRowActions() {
    if (!tbody) return;
    tbody.querySelectorAll('.pm-action-btn').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
            var action = this.getAttribute('data-action');
            var id     = this.getAttribute('data-id');
            var name   = this.getAttribute('data-name');

            if (action === 'edit') {
                // Native <a href> navigation — log destination for debugging
                console.log('[ProductList] Navigating to edit page:', this.href);
                return; // do NOT preventDefault — let the link navigate normally
            }

            if (action === 'delete') {
                e.preventDefault();
                var confirmed = window.confirm('Delete "' + name + '"? This cannot be undone.');
                if (!confirmed) return;
                deleteProduct(id, name);
            }
        });
    });
}

function deleteProduct(id, name) {
    fetch(API_BASE_URL + '/api/products/' + id, {
        method: 'DELETE',
        headers: getAuthHeaders()
    })
        .then(function (res) {
            if (!res.ok) {
                return res.json().then(function (d) {
                    throw new Error((d && d.detail) || 'Delete failed');
                }).catch(function () {
                    throw new Error('Delete failed (status ' + res.status + ')');
                });
            }
            // Animate row out then re-fetch
            var row = tbody ? tbody.querySelector('tr[data-id="' + id + '"]') : null;
            if (row) {
                row.style.transition = 'opacity 0.25s ease';
                row.style.opacity = '0';
                setTimeout(function () {
                    allProducts = allProducts.filter(function (p) { return String(p.id) !== String(id); });
                    renderTable(allProducts);
                    showToast('"' + name + '" deleted successfully.');
                }, 260);
            } else {
                allProducts = allProducts.filter(function (p) { return String(p.id) !== String(id); });
                renderTable(allProducts);
                showToast('"' + name + '" deleted successfully.');
            }
        })
        .catch(function (err) {
            showToast(err.message || 'Failed to delete product.', true);
        });
}

/* -------------------------------------------------------
   FETCH PRODUCTS FROM API
   ------------------------------------------------------- */
function fetchProducts() {
    showLoading();

    fetch(API_BASE_URL + '/api/products/', {
        method: 'GET',
        headers: getAuthHeaders()
    })
        .then(function (res) {
            if (!res.ok) throw new Error('Failed to load products (status ' + res.status + ')');
            return res.json();
        })
        .then(function (data) {
            var products = Array.isArray(data) ? data : (data.products || data.items || []);
            renderTable(products);
        })
        .catch(function (err) {
            console.error('[ProductList] Fetch error:', err);
            if (tbody) {
                tbody.innerHTML =
                    '<tr><td colspan="6" style="text-align:center;padding:40px 0;' +
                    'font-size:0.75rem;letter-spacing:0.1em;text-transform:uppercase;color:#c0392b;">' +
                    'FAILED TO LOAD PRODUCTS. PLEASE REFRESH.' +
                    '</td></tr>';
            }
        });
}

/* -------------------------------------------------------
   MOBILE SIDEBAR TOGGLE
   ------------------------------------------------------- */
function initSidebarToggle() {
    var hamburgerBtn = document.getElementById('admin-hamburger-btn');
    var sidebar      = document.getElementById('admin-sidebar');
    var overlay      = document.getElementById('admin-sidebar-overlay');

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
    fetchProducts();
});
