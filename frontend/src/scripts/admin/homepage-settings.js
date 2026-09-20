/**
 * homepage-settings.js — BARE MONDRIAN Admin
 * Homepage Settings page:
 *   - Auth guard & API connection
 *   - Hero image: fetch current, upload new photo, cancel/save
 *   - Products: fetch from GET /api/products/, search filter, category filter,
 *               PATCH /api/products/{id}/featured toggle, selected counter
 */

'use strict';

var API_BASE_URL = 'http://localhost:8000';

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
    var token = localStorage.getItem('token');
    var role   = localStorage.getItem('role');
    if (!token || role !== 'admin') {
        window.location.href = '../pages/login.html';
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
var productsData = [];

var heroState = {
    currentSrc: '/hero_model.png',
    currentFilename: 'hero_model.png',
    currentDimensions: '',
    pendingFile: null,
    pendingSrc: null,
    hasUnsavedChanges: false
};

/* -------------------------------------------------------
   DOM REFERENCES
   ------------------------------------------------------- */
// Hero
var heroPreviewImg      = document.getElementById('hero-preview-img');
var heroPreviewPh       = document.getElementById('hero-preview-placeholder');
var heroFilenameEl      = document.getElementById('hero-filename');
var heroDimensionsEl    = document.getElementById('hero-dimensions');
var heroDropzone        = document.getElementById('hero-dropzone');
var heroFileInput       = document.getElementById('hero-file-input');
var dropzoneSelectBtn   = document.getElementById('dropzone-select-btn');
var btnHeroCancel       = document.getElementById('btn-hero-cancel');
var btnHeroSave         = document.getElementById('btn-hero-save');

// Products
var productsGrid        = document.getElementById('products-grid');
var productsSearchInput = document.getElementById('products-search-input');
var categorySelect      = document.getElementById('products-category-select');
var selectedPill        = document.getElementById('products-selected-pill');

/* -------------------------------------------------------
   HELPERS
   ------------------------------------------------------- */
function formatPrice(n) {
    return 'Rp' + Number(n || 0).toLocaleString('id-ID');
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/* -------------------------------------------------------
   HERO — FETCH & RENDER
   ------------------------------------------------------- */
function renderHeroPreview(src, filename, dimensions) {
    if (!heroPreviewImg || !heroPreviewPh) return;
    heroPreviewImg.style.display = 'block';
    heroPreviewPh.style.display = 'none';
    heroPreviewImg.src = src;
    if (heroFilenameEl) heroFilenameEl.textContent = filename;
    if (heroDimensionsEl) heroDimensionsEl.textContent = dimensions || '';
}

function fetchHeroImage() {
    fetch(API_BASE_URL + '/api/homepage/hero-image')
        .then(function (res) {
            if (!res.ok) throw new Error('Failed to load hero image');
            return res.json();
        })
        .then(function (data) {
            if (data && data.hero_image_url) {
                var rawUrl = data.hero_image_url;
                var fullUrl = (rawUrl.indexOf('/') === 0 && rawUrl.indexOf('/uploads/') === 0) ? (API_BASE_URL + rawUrl) : rawUrl;
                var filename = rawUrl.substring(rawUrl.lastIndexOf('/') + 1) || 'hero_image';
                heroState.currentSrc = fullUrl;
                heroState.currentFilename = filename;
                renderHeroPreview(fullUrl, filename, heroState.currentDimensions);
            }
        })
        .catch(function (err) {
            console.error('[HomepageSettings] Fetch hero image error:', err);
        });
}

/* -------------------------------------------------------
   HERO — FILE SELECTION
   ------------------------------------------------------- */
function handleFileSelected(file) {
    if (!file) return;

    var allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
        alert('Please select a JPG, PNG, or WEBP image.');
        return;
    }
    if (file.size > 10 * 1024 * 1024) {
        alert('File size exceeds 10 MB. Please choose a smaller image.');
        return;
    }

    if (heroState.pendingSrc) {
        URL.revokeObjectURL(heroState.pendingSrc);
    }

    var objectUrl = URL.createObjectURL(file);
    heroState.pendingFile = file;
    heroState.pendingSrc = objectUrl;
    heroState.hasUnsavedChanges = true;

    var tempImg = new Image();
    tempImg.onload = function () {
        var dims = tempImg.naturalWidth + ' x ' + tempImg.naturalHeight + 'px';
        renderHeroPreview(objectUrl, file.name, dims);
    };
    tempImg.onerror = function () {
        renderHeroPreview(objectUrl, file.name, '');
    };
    tempImg.src = objectUrl;
}

function initHeroDropzone() {
    if (!heroFileInput || !heroDropzone || !dropzoneSelectBtn) return;

    heroFileInput.addEventListener('change', function () {
        if (heroFileInput.files && heroFileInput.files[0]) {
            handleFileSelected(heroFileInput.files[0]);
        }
        heroFileInput.value = '';
    });

    dropzoneSelectBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        heroFileInput.click();
    });

    heroDropzone.addEventListener('dragover', function (e) {
        e.preventDefault();
        heroDropzone.classList.add('dragover');
    });

    heroDropzone.addEventListener('dragleave', function (e) {
        if (!heroDropzone.contains(e.relatedTarget)) {
            heroDropzone.classList.remove('dragover');
        }
    });

    heroDropzone.addEventListener('drop', function (e) {
        e.preventDefault();
        heroDropzone.classList.remove('dragover');
        var files = e.dataTransfer.files;
        if (files && files[0]) {
            handleFileSelected(files[0]);
        }
    });

    heroDropzone.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            heroFileInput.click();
        }
    });
}

/* -------------------------------------------------------
   HERO — CANCEL / SAVE
   ------------------------------------------------------- */
function initHeroActions() {
    if (btnHeroCancel) {
        btnHeroCancel.addEventListener('click', function () {
            if (heroState.pendingSrc) {
                URL.revokeObjectURL(heroState.pendingSrc);
                heroState.pendingSrc = null;
            }
            heroState.pendingFile = null;
            heroState.hasUnsavedChanges = false;
            renderHeroPreview(heroState.currentSrc, heroState.currentFilename, heroState.currentDimensions);
        });
    }

    if (btnHeroSave) {
        btnHeroSave.addEventListener('click', function () {
            if (!heroState.hasUnsavedChanges || !heroState.pendingFile) {
                alert('No unsaved hero image changes.');
                return;
            }

            btnHeroSave.disabled = true;
            btnHeroSave.textContent = 'SAVING...';

            var formData = new FormData();
            formData.append('file', heroState.pendingFile);

            var token = localStorage.getItem('token');
            var headers = {};
            if (token) headers['Authorization'] = 'Bearer ' + token;

            fetch(API_BASE_URL + '/api/homepage/hero-image', {
                method: 'POST',
                headers: headers,
                body: formData
            })
            .then(function (res) {
                if (!res.ok) {
                    return res.json().then(function (err) {
                        throw new Error((err && err.detail) || 'Failed to upload hero image');
                    }).catch(function () {
                        throw new Error('Upload failed (status ' + res.status + ')');
                    });
                }
                return res.json();
            })
            .then(function (data) {
                btnHeroSave.disabled = false;
                btnHeroSave.textContent = 'SAVE CHANGES';

                var rawUrl = data.hero_image_url;
                var fullUrl = (rawUrl.indexOf('/') === 0 && rawUrl.indexOf('/uploads/') === 0) ? (API_BASE_URL + rawUrl) : rawUrl;
                var filename = rawUrl.substring(rawUrl.lastIndexOf('/') + 1) || 'hero_image';

                if (heroState.pendingSrc) {
                    URL.revokeObjectURL(heroState.pendingSrc);
                    heroState.pendingSrc = null;
                }

                heroState.currentSrc = fullUrl;
                heroState.currentFilename = filename;
                heroState.pendingFile = null;
                heroState.hasUnsavedChanges = false;

                renderHeroPreview(fullUrl, filename, '');
                alert('Hero image updated successfully!');
            })
            .catch(function (err) {
                btnHeroSave.disabled = false;
                btnHeroSave.textContent = 'SAVE CHANGES';
                alert(err.message || 'Failed to update hero image.');
            });
        });
    }
}

/* -------------------------------------------------------
   PRODUCTS — FETCH
   ------------------------------------------------------- */
function fetchProducts() {
    if (!productsGrid) return;
    productsGrid.innerHTML = '<p class="products-grid-empty">LOADING PRODUCTS…</p>';

    fetch(API_BASE_URL + '/api/products/', {
        method: 'GET',
        headers: getAuthHeaders()
    })
    .then(function (res) {
        if (!res.ok) throw new Error('Failed to load products (status ' + res.status + ')');
        return res.json();
    })
    .then(function (data) {
        productsData = Array.isArray(data) ? data : (data.products || data.items || []);
        populateCategories(productsData);
        renderProductGrid();
        updateSelectedCounter();
    })
    .catch(function (err) {
        console.error('[HomepageSettings] Fetch products error:', err);
        if (productsGrid) {
            productsGrid.innerHTML = '<p class="products-grid-empty" style="color:#c0392b;">FAILED TO LOAD PRODUCTS.</p>';
        }
    });
}

function populateCategories(products) {
    if (!categorySelect) return;
    var categories = ['all'];
    products.forEach(function (p) {
        if (p.category) {
            var cat = String(p.category).trim().toLowerCase();
            if (cat && categories.indexOf(cat) === -1) {
                categories.push(cat);
            }
        }
    });

    var currentVal = categorySelect.value || 'all';
    categorySelect.innerHTML = categories.map(function (cat) {
        return '<option value="' + escapeHtml(cat) + '">' + escapeHtml(cat.toUpperCase()) + '</option>';
    }).join('');

    if (categories.indexOf(currentVal) !== -1) {
        categorySelect.value = currentVal;
    } else {
        categorySelect.value = 'all';
    }
}

/* -------------------------------------------------------
   PRODUCTS — COUNTER
   ------------------------------------------------------- */
function updateSelectedCounter() {
    if (!selectedPill) return;
    var count = productsData.filter(function (p) { return Boolean(p.is_featured); }).length;
    selectedPill.textContent = count + ' PRODUCT' + (count !== 1 ? 'S' : '') + ' SELECTED';
}

/* -------------------------------------------------------
   PRODUCTS — TOGGLE FEATURED VIA API
   ------------------------------------------------------- */
function toggleProduct(productId) {
    var product = productsData.find(function (p) { return String(p.id) === String(productId); });
    if (!product) return;

    var targetFeatured = !product.is_featured;

    fetch(API_BASE_URL + '/api/products/' + productId + '/featured', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ is_featured: targetFeatured })
    })
    .then(function (res) {
        if (!res.ok) {
            return res.json().then(function (err) {
                throw new Error((err && err.detail) || 'Failed to update featured status');
            }).catch(function () {
                throw new Error('Update failed (status ' + res.status + ')');
            });
        }
        return res.json();
    })
    .then(function (updatedProduct) {
        product.is_featured = updatedProduct.is_featured;
        syncCardUI(productId, product.is_featured);
        updateSelectedCounter();
    })
    .catch(function (err) {
        console.error('[HomepageSettings] Toggle featured error:', err);
        alert(err.message || 'Failed to update featured status.');
    });
}

function syncCardUI(productId, isSelected) {
    if (!productsGrid) return;
    var card = productsGrid.querySelector('[data-product-id="' + productId + '"]');
    if (!card) return;

    var thumbCheck = card.querySelector('.product-card-thumb-check');
    var checkbox   = card.querySelector('.product-card-checkbox');

    if (thumbCheck) {
        thumbCheck.classList.toggle('checked', isSelected);
        thumbCheck.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    }
    if (checkbox)   checkbox.checked = isSelected;
    card.classList.toggle('selected', isSelected);
}

/* -------------------------------------------------------
   PRODUCTS — RENDER GRID
   ------------------------------------------------------- */
function getFilteredProducts() {
    var query    = (productsSearchInput ? productsSearchInput.value : '').trim().toLowerCase();
    var category = categorySelect ? categorySelect.value : 'all';

    return productsData.filter(function (p) {
        var pCat            = (p.category || '').toLowerCase();
        var pName           = (p.title || p.name || '').toLowerCase();
        var matchesCategory = (category === 'all') || (pCat === category);
        var matchesSearch   = !query || pName.includes(query);
        return matchesCategory && matchesSearch;
    });
}

function buildProductCard(product) {
    var isSelected = Boolean(product.is_featured);
    var checkClass = isSelected ? 'product-card-thumb-check checked' : 'product-card-thumb-check';
    var cardClass  = isSelected ? 'product-card selected' : 'product-card';

    var name   = escapeHtml(product.title || product.name || 'Product');
    var price  = formatPrice(product.price);
    var imgSrc = product.image_url || '';

    return (
        '<div class="' + cardClass + '" data-product-id="' + product.id + '">' +
            '<div class="product-card-thumb-wrapper">' +
                (imgSrc
                    ? '<img src="' + escapeHtml(imgSrc) + '" alt="' + name + '" class="product-card-img"' +
                          ' onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'flex\';">' +
                      '<div class="product-card-img-placeholder" style="display:none;">'
                    : '<div class="product-card-img-placeholder" style="display:flex;">'
                ) +
                    '<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1">' +
                        '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
                        '<circle cx="8.5" cy="8.5" r="1.5"/>' +
                        '<polyline points="21 15 16 10 5 21"/>' +
                    '</svg>' +
                '</div>' +
                '<div class="' + checkClass + '" data-thumb-id="' + product.id + '" role="checkbox" tabindex="0"' +
                    ' aria-checked="' + isSelected + '" aria-label="Toggle ' + name + ' on homepage">' +
                    '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' +
                        '<polyline points="20 6 9 17 4 12"/>' +
                    '</svg>' +
                '</div>' +
            '</div>' +
            '<div class="product-card-info">' +
                '<span class="product-card-name">' + name + '</span>' +
                '<span class="product-card-price">' + price + '</span>' +
            '</div>' +
            '<div class="product-card-footer">' +
                '<input type="checkbox" class="product-card-checkbox" id="chk-' + product.id + '"' +
                    (isSelected ? ' checked' : '') + ' data-checkbox-id="' + product.id + '"' +
                    ' aria-label="Show ' + name + ' on homepage">' +
                '<label for="chk-' + product.id + '" class="product-card-checkbox-label">SHOWN ON HOMEPAGE</label>' +
            '</div>' +
        '</div>'
    );
}

function renderProductGrid() {
    if (!productsGrid) return;
    var filtered = getFilteredProducts();

    if (filtered.length === 0) {
        productsGrid.innerHTML = '<p class="products-grid-empty">No products match your search.</p>';
        return;
    }

    productsGrid.innerHTML = filtered.map(buildProductCard).join('');
    bindProductCardEvents();
}

/* -------------------------------------------------------
   PRODUCTS — EVENT BINDING (re-bound after each render)
   ------------------------------------------------------- */
function bindProductCardEvents() {
    if (!productsGrid) return;

    // Thumbnail checkbox overlay
    productsGrid.querySelectorAll('.product-card-thumb-check').forEach(function (el) {
        el.addEventListener('click', function () {
            toggleProduct(el.getAttribute('data-thumb-id'));
        });
        el.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleProduct(el.getAttribute('data-thumb-id'));
            }
        });
    });

    // "SHOWN ON HOMEPAGE" checkbox
    productsGrid.querySelectorAll('.product-card-checkbox').forEach(function (el) {
        el.addEventListener('change', function () {
            toggleProduct(el.getAttribute('data-checkbox-id'));
        });
    });
}

/* -------------------------------------------------------
   PRODUCTS — FILTER CONTROLS
   ------------------------------------------------------- */
function initProductFilters() {
    if (productsSearchInput) productsSearchInput.addEventListener('input', renderProductGrid);
    if (categorySelect) categorySelect.addEventListener('change', renderProductGrid);
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

    // Hero setup
    fetchHeroImage();
    initHeroDropzone();
    initHeroActions();

    // Products setup
    fetchProducts();
    initProductFilters();

    // Mobile navigation
    initSidebarToggle();
});
