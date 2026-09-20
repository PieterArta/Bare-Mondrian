// product.js — Shop Page & Product Detail Page API Integration + Interactivity

// ─── Config ───────────────────────────────────────────────────────────────
const API_BASE_URL = 'http://localhost:8000';

// ─── Shop Page: API-driven product grid ───────────────────────────────────
(function initShopPage() {
    var grid = document.getElementById('shop-grid');
    if (!grid) return; // Not on shop page — skip

    var sortSelect = document.getElementById('sort-select');

    /** All products fetched from the API (source of truth for filter/sort) */
    var allProducts = [];
    /** Current search term (from navbar search input) */
    var currentSearch = '';

    // ── Helpers ──────────────────────────────────────────────────────────

    /** Format a number as IDR currency string, e.g. "IDR 3,500,000" */
    function formatIDR(value) {
        var num = Math.round(Number(value));
        return 'IDR ' + num.toLocaleString('id-ID');
    }

    /** Return true if created_at is within the last 7 days */
    function isNew(createdAt) {
        if (!createdAt) return false;
        var created = new Date(createdAt);
        var now = new Date();
        var diffMs = now - created;
        var diffDays = diffMs / (1000 * 60 * 60 * 24);
        return diffDays <= 7;
    }

    /** Escape a string for safe use inside an HTML attribute */
    function escapeAttr(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    // ── Skeleton / Loading state ─────────────────────────────────────────

    function showSkeleton() {
        var html = '';
        for (var i = 0; i < 8; i++) {
            html += '<div class="shop-card shop-card--skeleton" aria-hidden="true">' +
                '<div class="shop-card-image-wrapper skeleton-block"></div>' +
                '<div class="shop-card-info">' +
                '<div class="skeleton-line skeleton-line--name"></div>' +
                '<div class="skeleton-line skeleton-line--price"></div>' +
                '<div class="skeleton-line skeleton-line--buy"></div>' +
                '</div>' +
                '</div>';
        }
        grid.innerHTML = html;
    }

    // ── Empty / Error states ─────────────────────────────────────────────

    function showEmpty() {
        grid.innerHTML =
            '<div class="shop-state-message" id="shop-empty-msg">' +
            '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
            '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
            '<circle cx="8.5" cy="8.5" r="1.5"/>' +
            '<polyline points="21 15 16 10 5 21"/>' +
            '</svg>' +
            '<p>No products available.</p>' +
            '</div>';
    }

    function showError() {
        grid.innerHTML =
            '<div class="shop-state-message shop-state-message--error" id="shop-error-msg">' +
            '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
            '<circle cx="12" cy="12" r="10"/>' +
            '<line x1="12" y1="8" x2="12" y2="12"/>' +
            '<line x1="12" y1="16" x2="12.01" y2="16"/>' +
            '</svg>' +
            '<p>Failed to load products.</p>' +
            '<button class="shop-retry-btn" id="shop-retry-btn" onclick="window.__shopRetry && window.__shopRetry()">TRY AGAIN</button>' +
            '</div>';
    }

    function showNoResults() {
        grid.innerHTML =
            '<div class="shop-state-message" id="shop-no-results-msg">' +
            '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
            '<circle cx="11" cy="11" r="7"/>' +
            '<line x1="16.5" y1="16.5" x2="21.5" y2="21.5" stroke-linecap="round"/>' +
            '</svg>' +
            '<p>No products match your search.</p>' +
            '</div>';
    }

    // ── Card HTML builder ────────────────────────────────────────────────

    function buildCardHTML(product, index) {
        var detailHref = '/product-detail?id=' + product.id;
        var ariaLabel = escapeAttr(product.title);
        var badgeHTML = isNew(product.created_at)
            ? '<span class="shop-badge-new">NEW</span>'
            : '';

        var imageHTML;
        if (product.image_url) {
            imageHTML =
                '<img src="' + escapeAttr(product.image_url) + '" alt="' + ariaLabel + '" ' +
                'class="shop-card-img" onerror="this.style.display=\'none\'">' +
                '<div class="shop-card-placeholder">' +
                '<svg viewBox="0 0 24 24" width="32" height="32"><rect x="3" y="3" width="18" height="18" rx="2"/>' +
                '<circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' +
                '</div>';
        } else {
            imageHTML =
                '<div class="shop-card-placeholder">' +
                '<svg viewBox="0 0 24 24" width="32" height="32"><rect x="3" y="3" width="18" height="18" rx="2"/>' +
                '<circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' +
                '</div>';
        }

        var cardId = 'shop-card-' + product.id;
        var wishlistId = 'wishlist-' + product.id;

        return '<div class="shop-card" id="' + cardId + '">' +
            '<div class="shop-card-image-wrapper">' +
            '<a href="' + detailHref + '" class="shop-card-image-link" aria-label="' + ariaLabel + '">' +
            imageHTML +
            '</a>' +
            badgeHTML +
            '<button class="shop-wishlist-btn" id="' + wishlistId + '" aria-label="Add ' + ariaLabel + ' to wishlist">' +
            '<svg viewBox="0 0 24 24" width="20" height="20">' +
            '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>' +
            '</svg>' +
            '</button>' +
            '</div>' +
            '<div class="shop-card-info">' +
            '<a href="' + detailHref + '" class="shop-card-name">' + escapeAttr(product.title.toUpperCase()) + '</a>' +
            '<span class="shop-card-price">' + formatIDR(product.price) + '</span>' +
            '<a href="' + detailHref + '" class="shop-card-buy">BUY</a>' +
            '</div>' +
            '</div>';
    }

    // ── Render grid ──────────────────────────────────────────────────────

    function renderGrid(products) {
        if (!products || products.length === 0) {
            if (currentSearch) {
                showNoResults();
            } else {
                showEmpty();
            }
            return;
        }

        var html = '';
        for (var i = 0; i < products.length; i++) {
            html += buildCardHTML(products[i], i);
        }
        grid.innerHTML = html;

        // Re-attach wishlist toggle listeners after render
        var btns = grid.querySelectorAll('.shop-wishlist-btn');
        btns.forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                btn.classList.toggle('active');
            });
        });
    }

    // ── Sort + Filter pipeline ───────────────────────────────────────────

    function applyFiltersAndSort() {
        var sortVal = sortSelect ? sortSelect.value : 'featured';
        var term = currentSearch.trim().toLowerCase();

        // 1. Filter by search term
        var filtered = allProducts.filter(function (p) {
            if (!term) return true;
            return p.title.toLowerCase().indexOf(term) !== -1;
        });

        // 2. Sort
        var sorted = filtered.slice(); // shallow copy so we don't mutate allProducts
        if (sortVal === 'price-low') {
            sorted.sort(function (a, b) { return a.price - b.price; });
        } else if (sortVal === 'price-high') {
            sorted.sort(function (a, b) { return b.price - a.price; });
        } else if (sortVal === 'newest') {
            sorted.sort(function (a, b) {
                return new Date(b.created_at) - new Date(a.created_at);
            });
        }
        // 'featured' → keep API order (already sorted by backend)

        renderGrid(sorted);
    }

    // ── Fetch products ───────────────────────────────────────────────────

    function fetchProducts() {
        showSkeleton();
        fetch(API_BASE_URL + '/api/products/?limit=100')
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (data) {
                allProducts = Array.isArray(data) ? data : [];
                applyFiltersAndSort();
            })
            .catch(function (err) {
                console.error('[Shop] Failed to load products:', err);
                showError();
            });
    }

    // Expose retry handler for the error state button
    window.__shopRetry = fetchProducts;

    // ── Sort dropdown ────────────────────────────────────────────────────

    if (sortSelect) {
        sortSelect.addEventListener('change', function () {
            applyFiltersAndSort();
        });
    }

    // ── Navbar Search ────────────────────────────────────────────────────
    var searchOverlay = document.getElementById('search-overlay');
    var searchInput = document.getElementById('search-input') ||
        document.getElementById('navbar-search-input');
    var searchBtn = document.getElementById('btn-search');

    if (!searchInput && searchBtn) {
        var overlay = document.createElement('div');
        overlay.id = 'search-overlay';
        overlay.className = 'search-overlay';
        overlay.innerHTML =
            '<div class="search-overlay-inner">' +
            '<input type="text" id="search-input" class="search-overlay-input" ' +
            'placeholder="SEARCH PRODUCTS..." autocomplete="off" aria-label="Search products">' +
            '<button class="search-overlay-close" id="search-overlay-close" aria-label="Close search">&times;</button>' +
            '</div>';
        document.body.appendChild(overlay);

        searchInput = document.getElementById('search-input');
        var closeBtn = document.getElementById('search-overlay-close');

        searchBtn.addEventListener('click', function () {
            overlay.classList.add('active');
            searchInput.focus();
        });

        closeBtn.addEventListener('click', function () {
            overlay.classList.remove('active');
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && overlay.classList.contains('active')) {
                overlay.classList.remove('active');
            }
        });
    }

    if (searchInput) {
        var searchTimer = null;
        searchInput.addEventListener('input', function () {
            clearTimeout(searchTimer);
            var val = searchInput.value;
            searchTimer = setTimeout(function () {
                currentSearch = val;
                applyFiltersAndSort();
            }, 250);
        });
    }

    // ── Kick off ─────────────────────────────────────────────────────────
    fetchProducts();
})();


// ─── Product Detail Page Integration & Interactivity ─────────────────────
(function initProductDetailPage() {
    var mainContainer = document.querySelector('.product-detail-container');
    if (!mainContainer) return; // Not on product detail page — skip

    var currentProduct = null;

    // Color map for swatch background color heuristics
    var COLOR_MAP = {
        'ESPRESSO': '#3D2011',
        'ASH GREY': '#9E9E9E',
        'BLACK': '#111111',
        'WHITE': '#FFFFFF',
        'BEIGE': '#F5F5DC',
        'NAVY': '#000080',
        'CHARCOAL': '#36454F',
        'CREAM': '#FFFDD0',
        'BROWN': '#654321',
        'GREY': '#808080',
        'GRAY': '#808080'
    };

    function getColorHex(colorName) {
        if (!colorName) return '#888888';
        var upper = colorName.trim().toUpperCase();
        return COLOR_MAP[upper] || '#666666';
    }

    function formatRupiah(amount) {
        return 'RP ' + Math.round(Number(amount)).toLocaleString('id-ID');
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    // ── Parse Query Param ────────────────────────────────────────────────
    function getProductIdFromURL() {
        var params = new URLSearchParams(window.location.search);
        return params.get('id');
    }

    // ── Loading & Error UI States ────────────────────────────────────────
    function showLoadingState() {
        mainContainer.style.opacity = '0.5';
        mainContainer.style.pointerEvents = 'none';
    }

    function hideLoadingState() {
        mainContainer.style.opacity = '1';
        mainContainer.style.pointerEvents = 'all';
    }

    function showErrorState(msg) {
        mainContainer.innerHTML =
            '<div style="grid-column: 1 / -1; padding: 100px 24px; text-align: center;">' +
            '<h2 style="font-size: 1.2rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 12px; color: #111;">' + escapeHtml(msg) + '</h2>' +
            '<p style="font-size: 0.85rem; color: #777; margin-bottom: 24px;">The requested product could not be loaded.</p>' +
            '<a href="/shop" style="display: inline-block; padding: 12px 28px; background: #111; color: #fff; text-decoration: none; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;">BACK TO SHOP</a>' +
            '</div>';
    }

    // ── Dynamic Color Swatches Render ────────────────────────────────────
    function renderColorSwatches(colors) {
        var colorSections = document.querySelectorAll('.color-selection-section');
        if (!colors || colors.length === 0) {
            colors = ['DEFAULT'];
        }

        colorSections.forEach(function (sec) {
            var row = sec.querySelector('.color-swatches-row');
            if (!row) return;
            var html = '';
            colors.forEach(function (color, idx) {
                var colorName = color.trim().toUpperCase();
                var hex = getColorHex(colorName);
                var activeClass = idx === 0 ? ' active' : '';
                var borderStyle = colorName === 'WHITE' ? ' border: 1px solid #ccc;' : '';

                html += '<div class="color-swatch-item">' +
                    '<button class="color-swatch-btn' + activeClass + '" data-color="' + escapeHtml(colorName) + '" style="background-color: ' + hex + ';' + borderStyle + '" aria-label="' + escapeHtml(colorName) + '"></button>' +
                    '<span class="color-swatch-label' + activeClass + '">' + escapeHtml(colorName) + '</span>' +
                    '</div>';
            });
            row.innerHTML = html;
        });

        bindColorListeners();
    }

    function bindColorListeners() {
        var swatchBtns = document.querySelectorAll('.color-swatch-btn');
        swatchBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var selectedColor = this.getAttribute('data-color');
                swatchBtns.forEach(function (b) { b.classList.remove('active'); });
                document.querySelectorAll('.color-swatch-btn[data-color="' + selectedColor + '"]').forEach(function (b) {
                    b.classList.add('active');
                });
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
    }

    // ── Dynamic Size Toggles Render ──────────────────────────────────────
    function renderSizeToggles(sizes) {
        var sizeRow = document.querySelector('.size-toggles-row');
        if (!sizeRow) return;
        if (!sizes || sizes.length === 0) {
            sizes = ['FREE SIZE'];
        }

        var html = '';
        sizes.forEach(function (sz, idx) {
            var sizeStr = sz.trim().toUpperCase();
            var activeClass = idx === 0 ? ' active' : '';
            html += '<button class="size-toggle-btn' + activeClass + '" data-size="' + escapeHtml(sizeStr) + '">' + escapeHtml(sizeStr) + '</button>';
        });
        sizeRow.innerHTML = html;

        bindSizeListeners();
    }

    function bindSizeListeners() {
        var sizeBtns = document.querySelectorAll('.size-toggle-btn');
        var smCells = document.querySelectorAll('.col-sm');
        var lxlCells = document.querySelectorAll('.col-lxl');

        sizeBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var selectedSize = this.getAttribute('data-size');
                sizeBtns.forEach(function (b) { b.classList.remove('active'); });
                this.classList.add('active');

                // Sync table columns if S/M vs L/XL or generic indices
                if (selectedSize === 'S/M' || selectedSize.indexOf('S') !== -1) {
                    smCells.forEach(function (c) { c.classList.add('active'); });
                    lxlCells.forEach(function (c) { c.classList.remove('active'); });
                } else {
                    smCells.forEach(function (c) { c.classList.remove('active'); });
                    lxlCells.forEach(function (c) { c.classList.add('active'); });
                }
            });
        });
    }

    // ── Dynamic Sizing Table Render ──────────────────────────────────────
    function renderSizingTable(sizingChart) {
        var tableWrapper = document.querySelector('.measurements-table-wrapper');
        if (!tableWrapper) return;

        if (!sizingChart || typeof sizingChart !== 'object' || Object.keys(sizingChart).length === 0) {
            // Hide table section or show default fallback if null
            return;
        }

        var sizeKeys = Object.keys(sizingChart); // e.g. ["S/M", "L/XL"]
        if (sizeKeys.length === 0) return;

        // Collect all measurement names from the first size group (e.g. Bust, Shoulder Width...)
        var measurementNames = Object.keys(sizingChart[sizeKeys[0]] || {});

        var html = '<table class="measurements-table"><thead><tr><th></th>';
        sizeKeys.forEach(function (key, idx) {
            var colClass = idx === 0 ? 'col-sm active' : 'col-lxl';
            html += '<th class="' + colClass + '">' + escapeHtml(key) + '</th>';
        });
        html += '</tr></thead><tbody>';

        measurementNames.forEach(function (measureName) {
            html += '<tr><td>' + escapeHtml(measureName) + '</td>';
            sizeKeys.forEach(function (key, idx) {
                var colClass = idx === 0 ? 'col-sm active' : 'col-lxl';
                var val = (sizingChart[key] && sizingChart[key][measureName]) !== undefined
                    ? sizingChart[key][measureName]
                    : '-';
                html += '<td class="' + colClass + '">' + escapeHtml(val) + '</td>';
            });
            html += '</tr>';
        });

        html += '</tbody></table>';
        tableWrapper.innerHTML = html;
    }

    // ── Main Render Function ─────────────────────────────────────────────
    function renderProductDetails(product) {
        currentProduct = product;

        // Document Title & Description
        document.title = product.title.toUpperCase() + ' — BARE MONDRIAN';
        var metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc && product.description) {
            metaDesc.setAttribute('content', product.description);
        }

        // Product Image
        var imgEl = document.querySelector('.detail-product-img');
        if (imgEl) {
            if (product.image_url) {
                imgEl.src = product.image_url;
                imgEl.alt = product.title;
                imgEl.onerror = function () {
                    this.onerror = null;
                    this.src = 'assets/images/products/produk3.jpg';
                };
            } else {
                imgEl.src = 'assets/images/products/produk3.jpg';
                imgEl.alt = product.title;
            }
        }

        // Title & Price
        var titleEl = document.querySelector('.detail-product-title');
        if (titleEl) titleEl.textContent = product.title;

        var priceEl = document.querySelector('.detail-product-price');
        if (priceEl) priceEl.textContent = formatRupiah(product.price);

        // Accordion Contents & Right Panel Contents
        var descAcc = document.getElementById('accordion-desc');
        if (descAcc && product.description) {
            descAcc.innerHTML = '<p>' + escapeHtml(product.description) + '</p>';
        }
        var descPanel = document.querySelector('.panel-section .panel-paragraph');
        if (descPanel && product.description) {
            descPanel.textContent = product.description;
        }

        var matAcc = document.getElementById('accordion-material');
        if (matAcc) {
            var accHtml = '';
            if (product.composition) {
                accHtml += '<div style="margin-bottom: 12px;"><strong style="display:block; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 4px; color: #111;">COMPOSITION</strong><p>' + escapeHtml(product.composition) + '</p></div>';
            }
            if (product.care_instructions) {
                accHtml += '<div><strong style="display:block; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 4px; color: #111;">CARE INSTRUCTIONS</strong><p>' + escapeHtml(product.care_instructions) + '</p></div>';
            }
            if (accHtml) {
                matAcc.innerHTML = accHtml;
            }
        }

        var matPanel = document.querySelectorAll('.panel-section')[2]; // Material & Care panel section
        if (matPanel && (product.composition || product.care_instructions)) {
            var panelHtml = '<h3 class="panel-section-title">MATERIAL & CARE</h3>';
            if (product.composition) {
                panelHtml += '<div class="panel-subsection">' +
                    '<span class="panel-subtitle-small">COMPOSITION</span>' +
                    '<p class="panel-paragraph-small">' + escapeHtml(product.composition) + '</p>' +
                    '</div>';
            }
            if (product.care_instructions) {
                var topMargin = product.composition ? ' style="margin-top: 16px;"' : '';
                panelHtml += '<div class="panel-subsection"' + topMargin + '>' +
                    '<span class="panel-subtitle-small">CARE INSTRUCTIONS</span>' +
                    '<p class="panel-paragraph-small">' + escapeHtml(product.care_instructions) + '</p>' +
                    '</div>';
            }
            matPanel.innerHTML = panelHtml;
        }

        var shipAcc = document.getElementById('accordion-shipping');
        if (shipAcc && product.shipping_info) {
            shipAcc.innerHTML = '<p>' + escapeHtml(product.shipping_info) + '</p>';
        }
        var shipPanel = document.querySelectorAll('.panel-section')[3]; // Shipping panel section
        if (shipPanel && product.shipping_info) {
            var shipPara = shipPanel.querySelector('.panel-paragraph-small');
            if (shipPara) shipPara.textContent = product.shipping_info;
        }

        // Render Sizing Table if sizing_chart exists
        if (product.sizing_chart) {
            renderSizingTable(product.sizing_chart);
        }

        // Render Sizes & Colors
        renderSizeToggles(product.sizes);
        renderColorSwatches(product.colors);
    }

    // ── Interactive Behaviors ─────────────────────────────────────────────
    // Quantity Stepper
    var qtyInput = document.getElementById('detail-qty-input');
    var qtyMinusBtn = document.getElementById('detail-qty-minus');
    var qtyPlusBtn = document.getElementById('detail-qty-plus');

    if (qtyMinusBtn && qtyPlusBtn && qtyInput) {
        qtyMinusBtn.addEventListener('click', function () {
            var val = parseInt(qtyInput.value) || 1;
            if (val > 1) qtyInput.value = val - 1;
        });
        qtyPlusBtn.addEventListener('click', function () {
            var val = parseInt(qtyInput.value) || 1;
            qtyInput.value = val + 1;
        });
    }

    // Accordions
    var accordionHeaders = document.querySelectorAll('.accordion-header');
    accordionHeaders.forEach(function (header) {
        header.addEventListener('click', function () {
            var target = this.getAttribute('data-target');
            var content = document.getElementById('accordion-' + target);
            var chevron = this.querySelector('.chevron-icon');
            if (!content) return;

            accordionHeaders.forEach(function (h) {
                if (h !== header) {
                    var t = h.getAttribute('data-target');
                    var c = document.getElementById('accordion-' + t);
                    var chev = h.querySelector('.chevron-icon');
                    if (c) c.style.maxHeight = null;
                    if (chev) chev.classList.remove('active');
                }
            });

            if (content.style.maxHeight) {
                content.style.maxHeight = null;
                if (chevron) chevron.classList.remove('active');
            } else {
                content.style.maxHeight = content.scrollHeight + 'px';
                if (chevron) chevron.classList.add('active');
            }
        });
    });

    // Get Active Selections
    function getSelectedProductOptions() {
        var sizeBtn = document.querySelector('.size-toggle-btn.active');
        var colorBtn = document.querySelector('.color-swatch-btn.active');
        var qtyInput = document.getElementById('detail-qty-input');
        var qtyVal = qtyInput ? (parseInt(qtyInput.value) || 1) : 1;

        var sizeVal = sizeBtn ? sizeBtn.getAttribute('data-size') : '';
        var colorVal = colorBtn ? colorBtn.getAttribute('data-color') : '';

        var pId = currentProduct ? currentProduct.id : '1';
        var pName = currentProduct ? currentProduct.title : 'PRODUCT';
        var pPrice = currentProduct ? currentProduct.price : 0;
        var pImg = (currentProduct && currentProduct.image_url) ? currentProduct.image_url : 'assets/images/products/produk3.jpg';

        // Format size string display
        var sizeDisplay = sizeVal;
        if (sizeVal && colorVal) {
            sizeDisplay = sizeVal + ' / ' + colorVal;
        } else if (colorVal) {
            sizeDisplay = colorVal;
        }

        var productObj = {
            id: pId,
            name: pName,
            size: sizeDisplay || 'FREE SIZE',
            rawSize: sizeVal || '',
            color: colorVal || '',
            quantity: qtyVal,
            price: pPrice,
            image: pImg
        };

        console.log('[Product Detail] Captured selected options:', productObj);
        return productObj;
    }

    function addProductToCartState(product) {
        console.log('[Product Detail] Adding product to cart:', product);
        var cartItems = [];
        try {
            var saved = localStorage.getItem('bare_mondrian_cart');
            if (saved !== null && saved !== undefined && String(saved).trim() !== '') {
                var parsed = JSON.parse(saved);
                cartItems = Array.isArray(parsed) ? parsed : [];
            }
        } catch (ex) { console.error(ex); }

        console.log('[Product Detail] Cart state before adding:', cartItems);

        var matchedIndex = -1;
        for (var i = 0; i < cartItems.length; i++) {
            if (cartItems[i].id == product.id && cartItems[i].size === product.size) {
                matchedIndex = i;
                break;
            }
        }

        if (matchedIndex !== -1) {
            cartItems[matchedIndex].quantity += product.quantity;
        } else {
            cartItems.push(product);
        }

        console.log('[Product Detail] Cart state after adding:', cartItems);

        try {
            localStorage.setItem('bare_mondrian_cart', JSON.stringify(cartItems));
            console.log('[Product Detail] Saved updated cart to localStorage key "bare_mondrian_cart"');

            if (typeof window.renderCart === 'function') {
                console.log('[Product Detail] Invoking window.renderCart() to update drawer');
                window.renderCart();
            }
        } catch (ex) { console.error('[Product Detail] Failed to save cart:', ex); }
    }

    // Initial binding for static elements
    bindSizeListeners();
    bindColorListeners();

    // Buttons
    var addToCartBtn = document.getElementById('btn-add-to-cart');
    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', function () {
            console.log('[Product Detail] "ADD TO CART" button clicked');
            var product = getSelectedProductOptions();
            addProductToCartState(product);
            if (typeof window.openCart === 'function') {
                console.log('[Product Detail] Opening cart drawer via window.openCart()');
                window.openCart();
            } else {
                console.log('[Product Detail] Navigating to shop.html?openCart=true');
                window.location.href = 'shop.html?openCart=true';
            }
        });
    }

    var buyNowBtn = document.getElementById('btn-buy-now');
    if (buyNowBtn) {
        buyNowBtn.addEventListener('click', function () {
            console.log('[Product Detail] "BUY NOW" button clicked');
            var product = getSelectedProductOptions();
            addProductToCartState(product);
            window.location.href = 'checkout.html';
        });
    }

    // ── Fetch Product API ────────────────────────────────────────────────
    var productId = getProductIdFromURL() || '1'; // Fallback to product ID 1 if opened directly without query param


    showLoadingState();
    fetch(API_BASE_URL + '/api/products/' + productId)
        .then(function (res) {
            if (!res.ok) {
                throw new Error(res.status === 404 ? 'Product not found' : 'Failed to fetch product');
            }
            return res.json();
        })
        .then(function (data) {
            hideLoadingState();
            renderProductDetails(data);
        })
        .catch(function (err) {
            console.error('[Product Detail] Error:', err);
            hideLoadingState();
            showErrorState(err.message || 'Product not found');
        });

})();
