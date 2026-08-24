/**
 * product-list.js — BARE MONDRIAN Admin
 * Product Management list page: render table, delete with confirm, edit navigation.
 */
'use strict';

/* -------------------------------------------------------
   SHARED DUMMY DATA (also consumed by add-product.js if
   stored in localStorage for demo persistence)
   ------------------------------------------------------- */
var productsData = [
    {
        id: 'form-001',
        imgSrc: '/assets/images/products/form-001.jpg',
        name: 'FORM 001',
        category: 'OUTER',
        price: 1200000,
        stockQty: 24,
        stockStatus: 'IN STOCK'
    },
    {
        id: 'structure-02',
        imgSrc: '/assets/images/products/structure-02.jpg',
        name: 'STRUCTURE 02',
        category: 'OUTER',
        price: 1850000,
        stockQty: 3,
        stockStatus: 'LOW STOCK'
    },
    {
        id: 'base-trouser',
        imgSrc: '/assets/images/products/base-trouser.jpg',
        name: 'BASE TROUSER',
        category: 'CELANA',
        price: 950000,
        stockQty: 18,
        stockStatus: 'IN STOCK'
    }
];

/* -------------------------------------------------------
   DOM REFERENCES
   ------------------------------------------------------- */
var tbody      = document.getElementById('pm-tbody');
var emptyState = document.getElementById('pm-empty-state');

/* -------------------------------------------------------
   HELPERS
   ------------------------------------------------------- */
function formatPrice(n) {
    return n.toLocaleString('id-ID');
}

function buildStockBadge(status) {
    if (status === 'LOW STOCK') {
        return '<span class="pm-stock-badge pm-stock-badge--low">' + status + '</span>';
    }
    return '<span class="pm-stock-badge pm-stock-badge--in">' + status + '</span>';
}

function buildRow(product) {
    return (
        '<tr class="pm-tr" data-id="' + product.id + '">' +
            '<td class="pm-td pm-td--image">' +
                '<div class="pm-thumb-wrapper">' +
                    '<img src="' + product.imgSrc + '" alt="' + product.name + '" class="pm-thumb-img"' +
                        ' onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">' +
                    '<div class="pm-thumb-placeholder" style="display:none;"></div>' +
                '</div>' +
            '</td>' +
            '<td class="pm-td pm-td--name">' + product.name + '</td>' +
            '<td class="pm-td pm-td--category">' + product.category + '</td>' +
            '<td class="pm-td pm-td--price">' + formatPrice(product.price) + '</td>' +
            '<td class="pm-td pm-td--stock">' + buildStockBadge(product.stockStatus) + '</td>' +
            '<td class="pm-td pm-td--actions">' +
                '<div class="pm-actions-group">' +
                    '<button class="pm-action-btn" data-action="edit" data-id="' + product.id + '" aria-label="Edit ' + product.name + '" title="Edit">' +
                        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
                    '</button>' +
                    '<button class="pm-action-btn pm-action-btn--delete" data-action="delete" data-id="' + product.id + '" aria-label="Delete ' + product.name + '" title="Delete">' +
                        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>' +
                    '</button>' +
                '</div>' +
            '</td>' +
        '</tr>'
    );
}

/* -------------------------------------------------------
   RENDER
   ------------------------------------------------------- */
function renderTable() {
    if (productsData.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'flex';
        return;
    }
    emptyState.style.display = 'none';
    tbody.innerHTML = productsData.map(buildRow).join('');
    bindRowActions();
}

/* -------------------------------------------------------
   ROW ACTIONS
   ------------------------------------------------------- */
function bindRowActions() {
    tbody.querySelectorAll('.pm-action-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var action = btn.getAttribute('data-action');
            var id     = btn.getAttribute('data-id');

            if (action === 'edit') {
                window.location.href = 'add-product.html?edit=' + encodeURIComponent(id);
            }

            if (action === 'delete') {
                var product = productsData.find(function (p) { return p.id === id; });
                if (!product) return;
                var confirmed = window.confirm('Delete "' + product.name + '"? This cannot be undone.');
                if (!confirmed) return;

                // Remove from array
                productsData = productsData.filter(function (p) { return p.id !== id; });

                // Animate row out then re-render
                var row = tbody.querySelector('tr[data-id="' + id + '"]');
                if (row) {
                    row.style.transition = 'opacity 0.25s ease';
                    row.style.opacity = '0';
                    setTimeout(function () { renderTable(); }, 260);
                } else {
                    renderTable();
                }
            }
        });
    });
}

/* -------------------------------------------------------
   BOOT
   ------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', function () {
    renderTable();
});
