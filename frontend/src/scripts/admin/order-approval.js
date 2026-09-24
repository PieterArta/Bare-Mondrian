/**
 * order-approval.js — BARE MONDRIAN Admin
 * Payment Approval page: auth guard, fetch from API, filter tabs, approve/reject actions,
 * proof lightbox, search filtering.
 */

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
    // Fallback: check localStorage directly if auth.js helpers unavailable
    var token = localStorage.getItem('token');
    var role   = localStorage.getItem('role');
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
   STATE
   ------------------------------------------------------- */
var ordersData = [];
var currentFilter = 'pending';
var currentSearch = '';

/* -------------------------------------------------------
   DOM REFERENCES
   ------------------------------------------------------- */
var tbody          = document.getElementById('orders-tbody');
var emptyState     = document.getElementById('orders-empty-state');
var filterTabs     = document.querySelectorAll('.filter-tab');
var searchInput    = document.getElementById('orders-search-input');
var proofModal     = document.getElementById('proof-modal');
var proofModalImg  = document.getElementById('proof-modal-img');
var proofModalPh   = document.getElementById('proof-modal-placeholder');
var proofClose     = document.getElementById('proof-modal-close');
var proofBackdrop  = document.getElementById('proof-modal-backdrop');

/* -------------------------------------------------------
   HELPERS
   ------------------------------------------------------- */
function formatPrice(n) {
    return 'Rp' + Number(n || 0).toLocaleString('id-ID');
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

function getProofUrl(proofPath) {
    if (!proofPath) return '';
    if (proofPath.indexOf('http://') === 0 || proofPath.indexOf('https://') === 0 || proofPath.indexOf('data:') === 0) {
        return proofPath;
    }
    if (proofPath.indexOf('/') === 0) {
        return API_BASE_URL + proofPath;
    }
    return API_BASE_URL + '/' + proofPath;
}

function getDisplayId(id) {
    if (!id && id !== 0) return '';
    var str = String(id);
    return str.toUpperCase().indexOf('ORD-') === 0 ? str : 'ORD-' + str;
}

function calculateTotal(order) {
    if (order.total !== undefined && typeof order.total === 'number') {
        return formatPrice(order.total);
    }
    if (typeof order.total === 'string') {
        return order.total;
    }
    if (Array.isArray(order.items)) {
        var total = order.items.reduce(function (sum, item) {
            return sum + ((Number(item.unit_price) || 0) * (Number(item.quantity) || 1));
        }, 0);
        return formatPrice(total);
    }
    return formatPrice(0);
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

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/* -------------------------------------------------------
   RENDER & FILTER
   ------------------------------------------------------- */
function showLoading() {
    if (!tbody) return;
    tbody.innerHTML =
        '<tr>' +
        '<td colspan="8" style="text-align:center;padding:40px 0;font-size:0.75rem;' +
        'letter-spacing:0.15em;text-transform:uppercase;color:#999;">' +
        'LOADING ORDERS…' +
        '</td></tr>';
    if (emptyState) emptyState.style.display = 'none';
}

function formatWhatsAppLink(phone) {
    if (!phone) return '';
    var digits = String(phone).trim().replace(/[^\d+]/g, '');
    if (digits.indexOf('+') === 0) {
        digits = digits.substring(1);
    } else if (digits.indexOf('0') === 0) {
        digits = '62' + digits.substring(1);
    }
    return 'https://wa.me/' + digits;
}

function formatFullAddress(order) {
    var parts = [
        order.address,
        order.district,
        order.city,
        order.province,
        order.postal_code
    ].filter(function (p) { return p && String(p).trim() !== ''; });
    
    return parts.join(', ');
}

function buildCustomerCell(order) {
    var name = escapeHtml(order.recipient_name || order.customer || '—');
    var phone = order.recipient_phone || order.phone || '';
    var waUrl = formatWhatsAppLink(phone);
    var fullAddress = formatFullAddress(order);

    var phoneHtml = phone ? (
        '<a href="' + escapeHtml(waUrl) + '" target="_blank" rel="noopener noreferrer" class="orders-wa-link" title="Chat on WhatsApp (' + escapeHtml(phone) + ')">' +
            '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>' +
            '</svg>' +
            '<span>' + escapeHtml(phone) + '</span>' +
        '</a>'
    ) : '';

    var addressHtml = fullAddress ? (
        '<div class="orders-customer-address" title="' + escapeHtml(fullAddress) + '">' +
            '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>' +
                '<circle cx="12" cy="10" r="3"/>' +
            '</svg>' +
            '<span>' + escapeHtml(fullAddress) + '</span>' +
        '</div>'
    ) : '';

    return (
        '<div class="orders-customer-block">' +
            '<div class="orders-customer-name">' + name + '</div>' +
            phoneHtml +
            addressHtml +
        '</div>'
    );
}

function getFilteredOrders() {
    var q = currentSearch.trim().toLowerCase();

    return ordersData.filter(function (order) {
        // Status filter
        var status = (order.status || 'pending').toLowerCase();
        var statusMatch = (currentFilter === 'all') || (status === currentFilter);
        if (!statusMatch) return false;

        // Search filter (customer name, phone, address, or order ID)
        if (q) {
            var customer = (order.recipient_name || order.customer || '').toLowerCase();
            var phone = (order.recipient_phone || order.phone || '').toLowerCase();
            var address = formatFullAddress(order).toLowerCase();
            var rawId = String(order.id || '').toLowerCase();
            var displayId = getDisplayId(order.id).toLowerCase();
            var haystack = customer + ' ' + phone + ' ' + address + ' ' + rawId + ' ' + displayId + ' #' + displayId;
            if (haystack.indexOf(q) === -1) return false;
        }

        return true;
    });
}

function buildStatusCell(status) {
    var s = (status || 'pending').toLowerCase();
    if (s === 'pending') {
        return '<span class="orders-status-pending">PENDING</span>';
    }
    if (s === 'approved') {
        return '<span class="orders-status-approved">APPROVED</span>';
    }
    if (s === 'rejected') {
        return '<span class="orders-status-rejected">REJECTED</span>';
    }
    return '<span class="orders-status-pending">' + escapeHtml(s.toUpperCase()) + '</span>';
}

function buildActionsCell(orderId, status) {
    var s = (status || 'pending').toLowerCase();
    var isApproved = (s === 'approved');
    var isRejected = (s === 'rejected');

    var approveClass = isApproved ? 'btn-approve btn-approve--active' : 'btn-approve btn-approve--outline';
    var rejectClass  = isRejected ? 'btn-reject btn-reject--active'   : 'btn-reject btn-reject--outline';

    return (
        '<div class="orders-actions-group">' +
            '<button class="' + approveClass + '" data-id="' + orderId + '" data-status="' + s + '" aria-label="Approve order ' + orderId + '">' +
                (isApproved ? '✓ APPROVED' : 'APPROVE') +
            '</button>' +
            '<button class="' + rejectClass + '" data-id="' + orderId + '" data-status="' + s + '" aria-label="Reject order ' + orderId + '">' +
                (isRejected ? '✕ REJECTED' : 'REJECT') +
            '</button>' +
        '</div>'
    );
}

function buildProofCell(order) {
    var rawProof = order.payment_proof_url || order.proofSrc || '';
    var proofUrl = getProofUrl(rawProof);

    return (
        '<div class="proof-thumb-wrapper" data-proof="' + escapeHtml(proofUrl) + '" ' +
             'role="button" tabindex="0" aria-label="View payment proof for order ' + escapeHtml(order.id) + '">' +
            (proofUrl
                ? '<img src="' + escapeHtml(proofUrl) + '" alt="Proof #' + escapeHtml(order.id) + '" class="proof-thumb-img" ' +
                     'onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'flex\';">' +
                  '<div class="proof-thumb-placeholder" style="display:none;">' +
                      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5">' +
                          '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
                          '<circle cx="8.5" cy="8.5" r="1.5"/>' +
                          '<polyline points="21 15 16 10 5 21"/>' +
                      '</svg>' +
                  '</div>'
                : '<div class="proof-thumb-placeholder" style="display:flex;">' +
                      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5">' +
                          '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
                          '<circle cx="8.5" cy="8.5" r="1.5"/>' +
                          '<polyline points="21 15 16 10 5 21"/>' +
                      '</svg>' +
                  '</div>'
            ) +
        '</div>'
    );
}

function renderTable() {
    var filtered = getFilteredOrders();

    if (!tbody) return;

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.style.display = 'flex';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    var html = filtered.map(function (order) {
        var displayId = getDisplayId(order.id);
        var products  = escapeHtml(formatProducts(order));
        var total     = escapeHtml(calculateTotal(order));
        var status    = (order.status || 'pending').toLowerCase();
        var date      = escapeHtml(formatDate(order.created_at || order.date));

        return (
            '<tr class="orders-tr" data-id="' + order.id + '" data-status="' + status + '">' +
                '<td class="orders-td orders-td--id">#' + displayId + '</td>' +
                '<td class="orders-td orders-td--customer">' + buildCustomerCell(order) + '</td>' +
                '<td class="orders-td orders-td--product">' + products + '</td>' +
                '<td class="orders-td orders-td--total">' + total + '</td>' +
                '<td class="orders-td orders-td--proof">' + buildProofCell(order) + '</td>' +
                '<td class="orders-td orders-td--status">' + buildStatusCell(status) + '</td>' +
                '<td class="orders-td orders-td--date">' + date + '</td>' +
                '<td class="orders-td orders-td--actions">' + buildActionsCell(order.id, status) + '</td>' +
            '</tr>'
        );
    }).join('');

    tbody.innerHTML = html;
    bindRowActions();
}

/* -------------------------------------------------------
   ROW ACTION BINDINGS (re-bound after each render)
   ------------------------------------------------------- */
function bindRowActions() {
    if (!tbody) return;

    // APPROVE buttons
    tbody.querySelectorAll('.btn-approve').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var orderId = btn.getAttribute('data-id');
            var currentStatus = btn.getAttribute('data-status');

            if (currentStatus === 'approved') return;

            if (currentStatus === 'rejected') {
                var confirmed = window.confirm('This order is currently REJECTED. Are you sure you want to change its status to APPROVED?');
                if (!confirmed) return;
            }

            updateOrderStatus(orderId, 'approve');
        });
    });

    // REJECT buttons
    tbody.querySelectorAll('.btn-reject').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var orderId = btn.getAttribute('data-id');
            var currentStatus = btn.getAttribute('data-status');

            if (currentStatus === 'rejected') return;

            if (currentStatus === 'approved') {
                var confirmed = window.confirm('This order is currently APPROVED. Are you sure you want to change its status to REJECTED?');
                if (!confirmed) return;
            }

            updateOrderStatus(orderId, 'reject');
        });
    });

    // Proof thumbnails — click or keyboard Enter/Space
    tbody.querySelectorAll('.proof-thumb-wrapper').forEach(function (wrapper) {
        wrapper.addEventListener('click', function () {
            openProofModal(wrapper.getAttribute('data-proof'));
        });
        wrapper.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openProofModal(wrapper.getAttribute('data-proof'));
            }
        });
    });
}

function updateOrderStatus(orderId, actionType) {
    // actionType is 'approve' or 'reject'
    var targetStatus = (actionType === 'approve') ? 'approved' : 'rejected';
    var endpoint = API_BASE_URL + '/api/orders/' + orderId + '/' + actionType;

    var row = tbody ? tbody.querySelector('tr[data-id="' + orderId + '"]') : null;
    if (row) {
        row.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
    }

    fetch(endpoint, {
        method: 'PATCH',
        headers: getAuthHeaders()
    })
    .then(function (res) {
        if (!res.ok) {
            return res.json().then(function (d) {
                throw new Error((d && d.detail) || 'Failed to update order status');
            }).catch(function () {
                throw new Error('Update failed (status ' + res.status + ')');
            });
        }
        return res.json();
    })
    .then(function (updatedOrder) {
        var finalStatus = (updatedOrder && updatedOrder.status) ? updatedOrder.status : targetStatus;

        // Mutate local order object
        for (var i = 0; i < ordersData.length; i++) {
            if (String(ordersData[i].id) === String(orderId)) {
                ordersData[i].status = finalStatus;
                break;
            }
        }

        // Optimistic UI update
        if (row) {
            row.setAttribute('data-status', finalStatus);

            var statusTd = row.querySelector('.orders-td--status');
            if (statusTd) statusTd.innerHTML = buildStatusCell(finalStatus);

            var actionsTd = row.querySelector('.orders-td--actions');
            if (actionsTd) actionsTd.innerHTML = buildActionsCell(orderId, finalStatus);

            bindRowActions();

            if (currentFilter !== 'all' && currentFilter !== finalStatus) {
                row.style.transition = 'opacity 0.3s ease';
                row.style.opacity = '0';
                setTimeout(function () { renderTable(); }, 320);
            }
        } else {
            renderTable();
        }
    })

    .catch(function (err) {
        console.error('[OrderApproval] Update status error:', err);
        alert(err.message || 'Failed to update order status.');
        if (row) {
            row.querySelectorAll('button').forEach(function (b) { b.disabled = false; });
        }
    });
}

/* -------------------------------------------------------
   FETCH ORDERS FROM API
   ------------------------------------------------------- */
function fetchOrders() {
    showLoading();

    fetch(API_BASE_URL + '/api/orders/', {
        method: 'GET',
        headers: getAuthHeaders()
    })
    .then(function (res) {
        if (!res.ok) throw new Error('Failed to load orders (status ' + res.status + ')');
        return res.json();
    })
    .then(function (data) {
        ordersData = Array.isArray(data) ? data : [];
        renderTable();
    })
    .catch(function (err) {
        console.error('[OrderApproval] Fetch error:', err);
        if (tbody) {
            tbody.innerHTML =
                '<tr>' +
                '<td colspan="8" style="text-align:center;padding:40px 0;' +
                'font-size:0.75rem;letter-spacing:0.1em;text-transform:uppercase;color:#c0392b;">' +
                'FAILED TO LOAD ORDERS. PLEASE REFRESH.' +
                '</td></tr>';
        }
    });
}

/* -------------------------------------------------------
   FILTER TABS
   ------------------------------------------------------- */
function initFilterTabs() {
    filterTabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
            filterTabs.forEach(function (t) {
                t.classList.remove('filter-tab--active');
                t.setAttribute('aria-selected', 'false');
            });
            tab.classList.add('filter-tab--active');
            tab.setAttribute('aria-selected', 'true');

            currentFilter = tab.getAttribute('data-filter');
            renderTable();
        });
    });
}

/* -------------------------------------------------------
   SEARCH
   ------------------------------------------------------- */
function initSearch() {
    if (!searchInput) return;
    searchInput.addEventListener('input', function () {
        currentSearch = searchInput.value;
        renderTable();
    });
}

/* -------------------------------------------------------
   PROOF MODAL (LIGHTBOX)
   ------------------------------------------------------- */
function openProofModal(src) {
    if (!proofModal || !proofModalImg || !proofModalPh) return;

    if (src) {
        proofModalImg.style.display = 'block';
        proofModalPh.style.display = 'none';
        proofModalImg.src = '';
        proofModalImg.src = src;
    } else {
        proofModalImg.style.display = 'none';
        proofModalPh.style.display = 'flex';
    }

    proofModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    if (proofClose) proofClose.focus();
}

function closeProofModal() {
    if (!proofModal) return;
    proofModal.style.display = 'none';
    document.body.style.overflow = '';
    if (proofModalImg) proofModalImg.src = '';
}

function initProofModal() {
    if (proofClose) proofClose.addEventListener('click', closeProofModal);
    if (proofBackdrop) proofBackdrop.addEventListener('click', closeProofModal);

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && proofModal && proofModal.style.display !== 'none') {
            closeProofModal();
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
    initFilterTabs();
    initSearch();
    initProofModal();
    initSidebarToggle();
    fetchOrders();
});
