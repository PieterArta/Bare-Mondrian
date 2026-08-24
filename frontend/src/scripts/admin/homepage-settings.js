/**
 * homepage-settings.js — BARE MONDRIAN Admin
 * Homepage Settings page:
 *   - Hero image: drag-and-drop / file-select preview, cancel/save
 *   - Products: search filter, category filter, checkbox toggle, counter
 */

'use strict';

/* -------------------------------------------------------
   DUMMY PRODUCT DATA
   ------------------------------------------------------- */
var productsData = [
    {
        id: 'form-001',
        name: 'FORM 001',
        price: '1,200,000',
        category: 'jackets',
        imgSrc: '/assets/images/products/form-001.jpg',
        shownOnHomepage: true
    },
    {
        id: 'structure-02',
        name: 'STRUCTURE 02',
        price: '1,850,000',
        category: 'jackets',
        imgSrc: '/assets/images/products/structure-02.jpg',
        shownOnHomepage: false
    },
    {
        id: 'base-trouser',
        name: 'BASE TROUSER',
        price: '1,450,000',
        category: 'trousers',
        imgSrc: '/assets/images/products/base-trouser.jpg',
        shownOnHomepage: false
    },
    {
        id: 'void-jacket',
        name: 'VOID JACKET',
        price: '2,100,000',
        category: 'jackets',
        imgSrc: '/assets/images/products/void-jacket.jpg',
        shownOnHomepage: false
    },
    {
        id: 'essential-tee',
        name: 'ESSENTIAL TEE',
        price: '490,000',
        category: 'tops',
        imgSrc: '/assets/images/products/essential-tee.jpg',
        shownOnHomepage: false
    },
    {
        id: 'monolith-boots',
        name: 'MONOLITH BOOTS',
        price: '3,200,000',
        category: 'footwear',
        imgSrc: '/assets/images/products/monolith-boots.jpg',
        shownOnHomepage: false
    }
];

/* -------------------------------------------------------
   HERO IMAGE STATE
   ------------------------------------------------------- */
var heroState = {
    currentSrc: '/hero_model.png',
    currentFilename: 'hero_new_arrival_fw24.jpg',
    currentDimensions: '1892 x 899px',
    pendingSrc: null,          // ObjectURL of newly chosen file (not yet saved)
    pendingFilename: null,
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
   HERO — RENDER
   ------------------------------------------------------- */
function renderHeroPreview(src, filename, dimensions) {
    heroPreviewImg.style.display = 'block';
    heroPreviewPh.style.display = 'none';
    heroPreviewImg.src = src;
    heroFilenameEl.textContent = filename;
    heroDimensionsEl.textContent = dimensions || '';
}

/* -------------------------------------------------------
   HERO — FILE SELECTION
   ------------------------------------------------------- */
function handleFileSelected(file) {
    if (!file) return;

    // Validate type
    var allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
        alert('Please select a JPG, PNG, or WEBP image.');
        return;
    }

    // Validate size (10 MB)
    if (file.size > 10 * 1024 * 1024) {
        alert('File size exceeds 10 MB. Please choose a smaller image.');
        return;
    }

    // Revoke any existing pending object URL to avoid memory leaks
    if (heroState.pendingSrc) {
        URL.revokeObjectURL(heroState.pendingSrc);
    }

    var objectUrl = URL.createObjectURL(file);

    // Read dimensions via a temporary Image element
    var tempImg = new Image();
    tempImg.onload = function () {
        heroState.pendingSrc = objectUrl;
        heroState.pendingFilename = file.name;
        heroState.hasUnsavedChanges = true;

        var dims = tempImg.naturalWidth + ' x ' + tempImg.naturalHeight + 'px';
        renderHeroPreview(objectUrl, file.name, dims);
    };
    tempImg.onerror = function () {
        // Still show the preview even if dimensions can't be read
        heroState.pendingSrc = objectUrl;
        heroState.pendingFilename = file.name;
        heroState.hasUnsavedChanges = true;
        renderHeroPreview(objectUrl, file.name, '');
    };
    tempImg.src = objectUrl;
}

function initHeroDropzone() {
    // Native file input handles both click-to-browse and keyboard Enter
    heroFileInput.addEventListener('change', function () {
        if (heroFileInput.files && heroFileInput.files[0]) {
            handleFileSelected(heroFileInput.files[0]);
        }
        // Reset input value so same file can be re-selected
        heroFileInput.value = '';
    });

    // "SELECT FILE" button inside the dropzone — trigger the hidden input
    dropzoneSelectBtn.addEventListener('click', function (e) {
        e.stopPropagation();   // prevent bubbling to the dropzone div
        heroFileInput.click();
    });

    // Drag-and-drop events on the dropzone div
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

    // Keyboard accessibility for the dropzone wrapper itself
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
    btnHeroCancel.addEventListener('click', function () {
        // Revert to saved state
        if (heroState.pendingSrc) {
            URL.revokeObjectURL(heroState.pendingSrc);
            heroState.pendingSrc = null;
            heroState.pendingFilename = null;
        }
        heroState.hasUnsavedChanges = false;
        renderHeroPreview(heroState.currentSrc, heroState.currentFilename, heroState.currentDimensions);
    });

    btnHeroSave.addEventListener('click', function () {
        if (!heroState.hasUnsavedChanges) {
            console.log('[Homepage Settings] No hero image changes to save.');
            return;
        }

        // Commit pending → current (dummy save; real save would POST to backend)
        if (heroState.pendingSrc) {
            // Revoke previous current ObjectURL if it was a blob (won't error on real paths)
            if (heroState.currentSrc && heroState.currentSrc.startsWith('blob:')) {
                URL.revokeObjectURL(heroState.currentSrc);
            }
            heroState.currentSrc = heroState.pendingSrc;
            heroState.currentFilename = heroState.pendingFilename;
            heroState.pendingSrc = null;
            heroState.pendingFilename = null;
        }

        heroState.hasUnsavedChanges = false;

        console.log('[Homepage Settings] Hero image saved (dummy):', {
            filename: heroState.currentFilename,
            src: heroState.currentSrc
        });

        alert('Changes saved! (dummy — not yet connected to backend)');
    });
}

/* -------------------------------------------------------
   PRODUCTS — COUNTER
   ------------------------------------------------------- */
function updateSelectedCounter() {
    var count = productsData.filter(function (p) { return p.shownOnHomepage; }).length;
    selectedPill.textContent = count + ' PRODUCT' + (count !== 1 ? 'S' : '') + ' SELECTED';
}

/* -------------------------------------------------------
   PRODUCTS — TOGGLE
   ------------------------------------------------------- */
function toggleProduct(productId) {
    var product = productsData.find(function (p) { return p.id === productId; });
    if (!product) return;
    product.shownOnHomepage = !product.shownOnHomepage;
    syncCardUI(productId, product.shownOnHomepage);
    updateSelectedCounter();
}

function syncCardUI(productId, isSelected) {
    var card     = productsGrid.querySelector('[data-product-id="' + productId + '"]');
    if (!card) return;

    var thumbCheck = card.querySelector('.product-card-thumb-check');
    var checkbox   = card.querySelector('.product-card-checkbox');

    if (thumbCheck) thumbCheck.classList.toggle('checked', isSelected);
    if (checkbox)   checkbox.checked = isSelected;
    card.classList.toggle('selected', isSelected);
}

/* -------------------------------------------------------
   PRODUCTS — RENDER GRID
   ------------------------------------------------------- */
function getFilteredProducts() {
    var query    = (productsSearchInput.value || '').trim().toLowerCase();
    var category = categorySelect.value;

    return productsData.filter(function (p) {
        var matchesCategory = (category === 'all') || (p.category === category);
        var matchesSearch   = !query || p.name.toLowerCase().includes(query);
        return matchesCategory && matchesSearch;
    });
}

function buildProductCard(product) {
    var isSelected = product.shownOnHomepage;
    var checkClass = isSelected ? 'product-card-thumb-check checked' : 'product-card-thumb-check';
    var cardClass  = isSelected ? 'product-card selected' : 'product-card';

    return (
        '<div class="' + cardClass + '" data-product-id="' + product.id + '">' +
            '<div class="product-card-thumb-wrapper">' +
                '<img src="' + product.imgSrc + '" alt="' + product.name + '" class="product-card-img"' +
                    ' onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'flex\';">' +
                '<div class="product-card-img-placeholder" style="display:none;">' +
                    '<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1">' +
                        '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
                        '<circle cx="8.5" cy="8.5" r="1.5"/>' +
                        '<polyline points="21 15 16 10 5 21"/>' +
                    '</svg>' +
                '</div>' +
                '<div class="' + checkClass + '" data-thumb-id="' + product.id + '" role="checkbox" tabindex="0"' +
                    ' aria-checked="' + isSelected + '" aria-label="Toggle ' + product.name + ' on homepage">' +
                    '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' +
                        '<polyline points="20 6 9 17 4 12"/>' +
                    '</svg>' +
                '</div>' +
            '</div>' +
            '<div class="product-card-info">' +
                '<span class="product-card-name">' + product.name + '</span>' +
                '<span class="product-card-price">' + product.price + '</span>' +
            '</div>' +
            '<div class="product-card-footer">' +
                '<input type="checkbox" class="product-card-checkbox" id="chk-' + product.id + '"' +
                    (isSelected ? ' checked' : '') + ' data-checkbox-id="' + product.id + '"' +
                    ' aria-label="Show ' + product.name + ' on homepage">' +
                '<label for="chk-' + product.id + '" class="product-card-checkbox-label">SHOWN ON HOMEPAGE</label>' +
            '</div>' +
        '</div>'
    );
}

function renderProductGrid() {
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
    productsSearchInput.addEventListener('input', renderProductGrid);
    categorySelect.addEventListener('change', renderProductGrid);
}

/* -------------------------------------------------------
   BOOT
   ------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', function () {
    // Hero setup
    renderHeroPreview(heroState.currentSrc, heroState.currentFilename, heroState.currentDimensions);
    initHeroDropzone();
    initHeroActions();

    // Products setup
    renderProductGrid();
    updateSelectedCounter();
    initProductFilters();
});
