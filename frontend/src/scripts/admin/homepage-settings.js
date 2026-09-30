/**
 * homepage-settings.js — BARE MONDRIAN Admin
 * Homepage Settings page:
 *   - Auth guard & API connection
 *   - Hero image & Collection image: fetch current, upload new photo via Cropper.js, cancel/save
 *   - Products: fetch from GET /api/products/, search filter, category filter,
 *               PATCH /api/products/{id}/featured toggle, selected counter
 */

'use strict';

var API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:8000' 
    : 'https://bare-mondrian.onrender.com';

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
var productsData = [];

var imagesState = {
    hero: {
        currentUrl: '',
        currentFilename: '',
        pendingUrl: null, // this will hold the Cloudinary URL after crop+upload
        hasChanges: false
    },
    collection: {
        currentUrl: '',
        currentFilename: '',
        pendingUrl: null, // this will hold the Cloudinary URL after crop+upload
        hasChanges: false
    }
};

var activeCropper = null;

/* -------------------------------------------------------
   DOM REFERENCES
   ------------------------------------------------------- */
var btnImagesCancel = document.getElementById('btn-images-cancel');
var btnImagesSave   = document.getElementById('btn-images-save');

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
   IMAGES — FETCH & RENDER
   ------------------------------------------------------- */
function renderPreview(type) {
    var previewImg = document.getElementById(type + '-preview-img');
    var previewPh  = document.getElementById(type + '-preview-placeholder');
    var filenameEl = document.getElementById(type + '-filename');
    var dimsEl     = document.getElementById(type + '-dimensions');
    
    var state = imagesState[type];
    var urlToRender = state.pendingUrl || state.currentUrl;
    var filenameToRender = state.pendingUrl ? 'Uploaded image' : state.currentFilename;

    if (!previewImg || !previewPh) return;
    
    if (urlToRender) {
        previewImg.style.display = 'block';
        previewPh.style.display = 'none';
        previewImg.src = urlToRender;
        if (filenameEl) filenameEl.textContent = filenameToRender;
        if (dimsEl) {
            var tempImg = new Image();
            tempImg.onload = function() { dimsEl.textContent = tempImg.naturalWidth + ' x ' + tempImg.naturalHeight + 'px'; };
            tempImg.onerror = function() { dimsEl.textContent = ''; };
            tempImg.src = urlToRender;
        }
    } else {
        previewImg.style.display = 'none';
        previewPh.style.display = 'flex';
        if (filenameEl) filenameEl.textContent = 'No image';
        if (dimsEl) dimsEl.textContent = '';
    }
}

function fetchHomepageSettings() {
    fetch(API_BASE_URL + '/api/homepage/settings')
        .then(function (res) {
            if (!res.ok) throw new Error('Failed to load homepage settings');
            return res.json();
        })
        .then(function (data) {
            if (data) {
                var heroUrl = data.hero_image_url || '';
                var heroFullUrl = (heroUrl.indexOf('/') === 0 && heroUrl.indexOf('/uploads/') === 0) ? (API_BASE_URL + heroUrl) : heroUrl;
                imagesState.hero.currentUrl = heroFullUrl;
                imagesState.hero.currentFilename = heroUrl.substring(heroUrl.lastIndexOf('/') + 1) || 'hero_image';
                
                var collectionUrl = data.collection_image_url || '';
                var collectionFullUrl = (collectionUrl.indexOf('/') === 0 && collectionUrl.indexOf('/uploads/') === 0) ? (API_BASE_URL + collectionUrl) : collectionUrl;
                imagesState.collection.currentUrl = collectionFullUrl;
                imagesState.collection.currentFilename = collectionUrl.substring(collectionUrl.lastIndexOf('/') + 1) || 'collection_image';

                renderPreview('hero');
                renderPreview('collection');
            }
        })
        .catch(function (err) {
            console.error('[HomepageSettings] Fetch settings error:', err);
        });
}

/* -------------------------------------------------------
   CROPPER & UPLOAD
   ------------------------------------------------------- */
function closeCropModal() {
    var overlay = document.getElementById('crop-modal-overlay');
    if (overlay) overlay.style.display = 'none';
    if (activeCropper) {
        activeCropper.destroy();
        activeCropper = null;
    }
    var imgEl = document.getElementById('crop-modal-img');
    if (imgEl) imgEl.src = '';
}

function handleFileSelected(file, type) {
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

    var overlay = document.getElementById('crop-modal-overlay');
    var imgEl = document.getElementById('crop-modal-img');
    var confirmBtn = document.getElementById('crop-modal-confirm');
    var cancelBtn = document.getElementById('crop-modal-cancel');
    var closeBtn = document.getElementById('crop-modal-close');
    var subtitleEl = document.getElementById('crop-modal-subtitle');

    if (!overlay || !imgEl || typeof Cropper === 'undefined') {
        uploadImage(file, type);
        return;
    }

    var reader = new FileReader();
    reader.onload = function (e) {
        imgEl.src = e.target.result;
        overlay.style.display = 'flex';

        if (activeCropper) {
            activeCropper.destroy();
        }

        var aspectRatio = type === 'hero' ? 16 / 9 : 3 / 4;
        if (subtitleEl) {
            subtitleEl.textContent = type === 'hero' ? '16:9 LANDSCAPE RATIO' : '3:4 PORTRAIT RATIO';
        }

        activeCropper = new Cropper(imgEl, {
            aspectRatio: aspectRatio,
            viewMode: 1,
            autoCropArea: 0.9,
            dragMode: 'move',
            background: false,
            responsive: true,
            restore: false
        });

        confirmBtn.onclick = function () {
            if (!activeCropper) return;

            activeCropper.getCroppedCanvas({
                maxWidth: 1920,
                maxHeight: 1920
            }).toBlob(function (blob) {
                if (!blob) {
                    alert('Failed to crop image');
                    return;
                }

                var croppedFile = new File([blob], file.name, {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                });

                closeCropModal();
                uploadImage(croppedFile, type);
            }, 'image/jpeg', 0.9);
        };

        cancelBtn.onclick = function () { closeCropModal(); };
        closeBtn.onclick = function () { closeCropModal(); };
    };
    reader.readAsDataURL(file);
}

function uploadImage(file, type) {
    // Show some uploading state, simple alert or button state here...
    var btn = document.getElementById('btn-images-save');
    var originalText = btn.textContent;
    btn.textContent = 'UPLOADING...';
    btn.disabled = true;

    var formData = new FormData();
    formData.append('file', file);

    var token = localStorage.getItem('token');
    var headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;

    fetch(API_BASE_URL + '/api/upload/product-photo', {
        method: 'POST',
        headers: headers,
        body: formData
    })
    .then(function (res) {
        if (!res.ok) throw new Error('Upload failed');
        return res.json();
    })
    .then(function (data) {
        btn.textContent = originalText;
        btn.disabled = false;
        
        imagesState[type].pendingUrl = data.url;
        imagesState[type].hasChanges = true;
        renderPreview(type);
    })
    .catch(function (err) {
        btn.textContent = originalText;
        btn.disabled = false;
        console.error('Image upload error:', err);
        alert('Image upload failed. Please try again.');
    });
}

function initDropzone(type) {
    var fileInput = document.getElementById(type + '-file-input');
    var dropzone  = document.getElementById(type + '-dropzone');
    var selectBtn = document.getElementById(type + '-dropzone-select-btn');

    if (!fileInput || !dropzone || !selectBtn) return;

    fileInput.addEventListener('change', function () {
        if (fileInput.files && fileInput.files[0]) {
            handleFileSelected(fileInput.files[0], type);
        }
        fileInput.value = '';
    });

    selectBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        fileInput.click();
    });

    dropzone.addEventListener('dragover', function (e) {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', function (e) {
        if (!dropzone.contains(e.relatedTarget)) {
            dropzone.classList.remove('dragover');
        }
    });

    dropzone.addEventListener('drop', function (e) {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        var files = e.dataTransfer.files;
        if (files && files[0]) {
            handleFileSelected(files[0], type);
        }
    });

    dropzone.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInput.click();
        }
    });
}

/* -------------------------------------------------------
   IMAGES — CANCEL / SAVE
   ------------------------------------------------------- */
function initImagesActions() {
    if (btnImagesCancel) {
        btnImagesCancel.addEventListener('click', function () {
            imagesState.hero.pendingUrl = null;
            imagesState.hero.hasChanges = false;
            imagesState.collection.pendingUrl = null;
            imagesState.collection.hasChanges = false;
            renderPreview('hero');
            renderPreview('collection');
        });
    }

    if (btnImagesSave) {
        btnImagesSave.addEventListener('click', function () {
            if (!imagesState.hero.hasChanges && !imagesState.collection.hasChanges) {
                alert('No unsaved image changes.');
                return;
            }

            btnImagesSave.disabled = true;
            btnImagesSave.textContent = 'SAVING...';

            var payload = {};
            if (imagesState.hero.hasChanges) {
                payload.hero_image_url = imagesState.hero.pendingUrl;
            }
            if (imagesState.collection.hasChanges) {
                payload.collection_image_url = imagesState.collection.pendingUrl;
            }

            fetch(API_BASE_URL + '/api/homepage/settings', {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            })
            .then(function (res) {
                if (!res.ok) {
                    return res.json().then(function (err) {
                        throw new Error((err && err.detail) || 'Failed to update homepage settings');
                    }).catch(function () {
                        throw new Error('Update failed (status ' + res.status + ')');
                    });
                }
                return res.json();
            })
            .then(function (data) {
                btnImagesSave.disabled = false;
                btnImagesSave.textContent = 'SAVE CHANGES';
                
                // Update local state with saved URLs
                if (payload.hero_image_url) {
                    imagesState.hero.currentUrl = payload.hero_image_url;
                    imagesState.hero.pendingUrl = null;
                    imagesState.hero.hasChanges = false;
                }
                if (payload.collection_image_url) {
                    imagesState.collection.currentUrl = payload.collection_image_url;
                    imagesState.collection.pendingUrl = null;
                    imagesState.collection.hasChanges = false;
                }
                
                renderPreview('hero');
                renderPreview('collection');
                alert('Homepage images updated successfully!');
            })
            .catch(function (err) {
                btnImagesSave.disabled = false;
                btnImagesSave.textContent = 'SAVE CHANGES';
                alert(err.message || 'Failed to update homepage settings.');
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

    // Images setup
    fetchHomepageSettings();
    initDropzone('hero');
    initDropzone('collection');
    initImagesActions();

    // Products setup
    fetchProducts();
    initProductFilters();

    // Mobile navigation
    initSidebarToggle();
});
