/**
 * order-approval.js — BARE MONDRIAN Admin
 * Payment Approval page: filter tabs, approve/reject actions,
 * proof lightbox, search filtering.
 */

'use strict';

/* -------------------------------------------------------
   DUMMY DATA
   Each order object holds its current status so that
   approve/reject mutations survive tab switches.
   ------------------------------------------------------- */
var ordersData = [
    {
        id: 'ORD-9015',
        customer: 'SARAH CHEN',
        product: 'MONOLITH BOOTS',
        total: '$620.00',
        proofSrc: '/assets/images/proofs/proof-ord-9015.jpg',
        status: 'pending',   // 'pending' | 'approved' | 'rejected'
        date: 'OCT 24, 2023'
    },
    {
        id: 'ORD-9012',
        customer: 'ALEX MERCER',
        product: 'VOID JACKET',
        total: '$450.00',
        proofSrc: '/assets/images/proofs/proof-ord-9012.jpg',
        status: 'pending',
        date: 'OCT 24, 2023'
    },
    {
        id: 'ORD-8990',
        customer: 'MARCUS WRIGHT',
        product: 'STRUCTURE TEE',
        total: '$120.00',
        proofSrc: '/assets/images/proofs/proof-ord-8990.jpg',
        status: 'approved',
        date: 'OCT 23, 2023'
    }
];

/* -------------------------------------------------------
   STATE
   ------------------------------------------------------- */
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
   RENDER
   ------------------------------------------------------- */
function getFilteredOrders() {
    var q = currentSearch.trim().toLowerCase();

    return ordersData.filter(function (order) {
        // Status filter
        var statusMatch = (currentFilter === 'all') || (order.status === currentFilter);
        if (!statusMatch) return false;

        // Search filter (customer name or order ID)
        if (q) {
            var haystack = (order.customer + ' ' + order.id).toLowerCase();
            if (haystack.indexOf(q) === -1) return false;
        }

        return true;
    });
}

function buildStatusCell(status) {
    if (status === 'pending') {
        return '<span class="orders-status-pending">PENDING</span>';
    }
    if (status === 'approved') {
        return '<span class="orders-status-approved">APPROVED</span>';
    }
    if (status === 'rejected') {
        return '<span class="orders-status-rejected">REJECTED</span>';
    }
    return '';
}

function buildActionsCell(orderId, status) {
    if (status === 'pending') {
        return (
            '<div class="orders-actions-group">' +
                '<button class="btn-approve" data-id="' + orderId + '" aria-label="Approve order ' + orderId + '">APPROVE</button>' +
                '<button class="btn-reject"  data-id="' + orderId + '" aria-label="Reject order ' + orderId + '">REJECT</button>' +
            '</div>'
        );
    }
    return '<span class="orders-processed-label">PROCESSED</span>';
}

function buildProofCell(order) {
    return (
        '<div class="proof-thumb-wrapper" data-proof="' + order.proofSrc + '" ' +
             'role="button" tabindex="0" aria-label="View payment proof for ' + order.id + '">' +
            '<img src="' + order.proofSrc + '" alt="Proof ' + order.id + '" class="proof-thumb-img" ' +
                 'onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'flex\';">' +
            '<div class="proof-thumb-placeholder" style="display:none;">' +
                '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5">' +
                    '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
                    '<circle cx="8.5" cy="8.5" r="1.5"/>' +
                    '<polyline points="21 15 16 10 5 21"/>' +
                '</svg>' +
            '</div>' +
        '</div>'
    );
}

function renderTable() {
    var filtered = getFilteredOrders();

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'flex';
        return;
    }

    emptyState.style.display = 'none';

    var html = filtered.map(function (order) {
        return (
            '<tr class="orders-tr" data-id="' + order.id + '" data-status="' + order.status + '">' +
                '<td class="orders-td orders-td--id">#' + order.id + '</td>' +
                '<td class="orders-td orders-td--customer">' + order.customer + '</td>' +
                '<td class="orders-td orders-td--product">' + order.product + '</td>' +
                '<td class="orders-td orders-td--total">' + order.total + '</td>' +
                '<td class="orders-td orders-td--proof">' + buildProofCell(order) + '</td>' +
                '<td class="orders-td orders-td--status">' + buildStatusCell(order.status) + '</td>' +
                '<td class="orders-td orders-td--date">' + order.date + '</td>' +
                '<td class="orders-td orders-td--actions">' + buildActionsCell(order.id, order.status) + '</td>' +
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
    // APPROVE buttons
    tbody.querySelectorAll('.btn-approve').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var orderId = btn.getAttribute('data-id');
            updateOrderStatus(orderId, 'approved');
        });
    });

    // REJECT buttons
    tbody.querySelectorAll('.btn-reject').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var orderId = btn.getAttribute('data-id');
            updateOrderStatus(orderId, 'rejected');
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

function updateOrderStatus(orderId, newStatus) {
    // Find and mutate the order in our data array
    var order = ordersData.find(function (o) { return o.id === orderId; });
    if (!order) return;

    order.status = newStatus;

    // Optimistic UI: update only this row without full re-render
    var row = tbody.querySelector('tr[data-id="' + orderId + '"]');
    if (!row) return;

    row.setAttribute('data-status', newStatus);

    // Update status cell
    var statusTd = row.querySelector('.orders-td--status');
    if (statusTd) statusTd.innerHTML = buildStatusCell(newStatus);

    // Update actions cell
    var actionsTd = row.querySelector('.orders-td--actions');
    if (actionsTd) actionsTd.innerHTML = buildActionsCell(orderId, newStatus);

    // Re-bind new buttons in this row
    var approveBtn = row.querySelector('.btn-approve');
    var rejectBtn  = row.querySelector('.btn-reject');
    if (approveBtn) approveBtn.addEventListener('click', function () { updateOrderStatus(orderId, 'approved'); });
    if (rejectBtn)  rejectBtn.addEventListener('click',  function () { updateOrderStatus(orderId, 'rejected'); });

    // If the current filter would now hide this row, fade it out then re-render
    if (currentFilter !== 'all' && currentFilter !== newStatus) {
        row.style.transition = 'opacity 0.3s ease';
        row.style.opacity = '0';
        setTimeout(function () { renderTable(); }, 320);
    }
}

/* -------------------------------------------------------
   FILTER TABS
   ------------------------------------------------------- */
function initFilterTabs() {
    filterTabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
            // Update active class
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
    // Reset state
    proofModalImg.style.display = 'block';
    proofModalPh.style.display = 'none';
    proofModalImg.src = '';        // clear first to trigger onerror on broken srcs
    proofModalImg.src = src;

    proofModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    proofClose.focus();
}

function closeProofModal() {
    proofModal.style.display = 'none';
    document.body.style.overflow = '';
    proofModalImg.src = '';
}

function initProofModal() {
    proofClose.addEventListener('click', closeProofModal);
    proofBackdrop.addEventListener('click', closeProofModal);

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && proofModal.style.display !== 'none') {
            closeProofModal();
        }
    });
}

/* -------------------------------------------------------
   BOOT
   ------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', function () {
    initFilterTabs();
    initSearch();
    initProofModal();
    renderTable();
});
