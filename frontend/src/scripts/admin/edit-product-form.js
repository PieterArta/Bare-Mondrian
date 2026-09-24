/**
 * edit-product-form.js — BARE MONDRIAN Admin
 * Form logic for Edit Product page: auth guard, reading product ID, pre-filling data,
 * photo slots, color tags, size toggles, save, delete, and cancel actions via Backend API.
 */
(function () {
    'use strict';

    var API_BASE_URL = 'https://bare-mondrian.onrender.com';
    var MAX_SLOTS = 3;

    // State
    var colorList = [];
    var photoSlots = [null, null, null]; // String URL or { file: File, url: string }

    // ─── AUTH GUARD ────────────────────────────────────────────────────────
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
        var headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = 'Bearer ' + token;
        }
        return headers;
    }

    // ─── GET PRODUCT ID FROM URL ───────────────────────────────────────────
    function getProductId() {
        var params = new URLSearchParams(window.location.search);
        return params.get('id');
    }

    // ─── HELPERS ──────────────────────────────────────────────────────────
    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function showFormError(message) {
        var errorEl = document.getElementById('ap-form-error');
        if (!errorEl) {
            errorEl = document.createElement('div');
            errorEl.id = 'ap-form-error';
            errorEl.style.cssText =
                'color:#c0392b;background:#fdf0ed;border:1px solid #f5c6cb;padding:12px 16px;margin-bottom:20px;font-size:0.85rem;font-weight:600;';
            var form = document.getElementById('edit-product-form');
            if (form) {
                form.insertBefore(errorEl, form.firstChild);
            }
        }
        errorEl.textContent = message;
        errorEl.style.display = 'block';
        errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function clearFormError() {
        var errorEl = document.getElementById('ap-form-error');
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.style.display = 'none';
        }
    }

    // ─── PHOTO SLOTS & UPLOAD ─────────────────────────────────────────────
    function updateSlotUI(slotIndex) {
        var item  = photoSlots[slotIndex];
        var img   = document.getElementById('ap-slot-img-' + slotIndex);
        var ph    = document.getElementById('ap-slot-ph-' + slotIndex);
        var label = document.getElementById('ap-main-label-' + slotIndex);
        var rmBtn = document.getElementById('ap-slot-rm-' + slotIndex);

        if (!img || !ph) return;

        var src = item ? (typeof item === 'string' ? item : item.url) : null;

        if (src) {
            img.src = src;
            img.style.display = 'block';
            ph.style.display  = 'none';
            if (rmBtn) rmBtn.style.display = 'flex';
            if (label) label.style.display = (slotIndex === 0) ? 'flex' : 'none';
        } else {
            img.src = '';
            img.style.display = 'none';
            ph.style.display  = 'flex';
            if (rmBtn) rmBtn.style.display  = 'none';
            if (label) label.style.display  = 'none';
        }
    }

    function addPhotos(files) {
        Array.from(files).forEach(function (file) {
            var slotIdx = -1;
            for (var i = 0; i < MAX_SLOTS; i++) {
                if (!photoSlots[i]) {
                    slotIdx = i;
                    break;
                }
            }
            if (slotIdx === -1) return;

            var allowed = ['image/jpeg', 'image/png', 'image/webp'];
            if (!allowed.includes(file.type)) return;
            if (file.size > 5 * 1024 * 1024) {
                alert(file.name + ' exceeds 5 MB and was skipped.');
                return;
            }

            var url = URL.createObjectURL(file);
            photoSlots[slotIdx] = { file: file, url: url };
            updateSlotUI(slotIdx);
        });
    }

    function removePhoto(slotIndex) {
        var item = photoSlots[slotIndex];
        if (item && typeof item === 'object' && item.url && item.url.indexOf('blob:') === 0) {
            URL.revokeObjectURL(item.url);
        }
        photoSlots[slotIndex] = null;
        updateSlotUI(slotIndex);
    }

    function initPhotoUpload() {
        var fileInput = document.getElementById('ap-file-input');
        var dropzone  = document.getElementById('ap-dropzone');
        if (!fileInput || !dropzone) return;

        fileInput.addEventListener('change', function () {
            if (fileInput.files && fileInput.files.length) {
                addPhotos(fileInput.files);
            }
            fileInput.value = '';
        });

        dropzone.addEventListener('dragover', function (e) {
            e.preventDefault();
            dropzone.classList.add('ap-dropzone--over');
        });
        dropzone.addEventListener('dragleave', function (e) {
            if (!dropzone.contains(e.relatedTarget)) {
                dropzone.classList.remove('ap-dropzone--over');
            }
        });
        dropzone.addEventListener('drop', function (e) {
            e.preventDefault();
            dropzone.classList.remove('ap-dropzone--over');
            if (e.dataTransfer.files && e.dataTransfer.files.length) {
                addPhotos(e.dataTransfer.files);
            }
        });

        dropzone.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInput.click();
            }
        });

        for (var i = 0; i < MAX_SLOTS; i++) {
            (function (idx) {
                var rmBtn = document.getElementById('ap-slot-rm-' + idx);
                if (rmBtn) {
                    rmBtn.addEventListener('click', function (e) {
                        e.stopPropagation();
                        removePhoto(idx);
                    });
                }
            })(i);
        }
    }

    function getImageUrl(item) {
        return new Promise(function (resolve) {
            if (!item) {
                resolve(null);
                return;
            }
            if (typeof item === 'string') {
                resolve(item);
                return;
            }
            if (item.file) {
                var reader = new FileReader();
                reader.onload = function (e) {
                    resolve(e.target.result);
                };
                reader.onerror = function () {
                    resolve(null);
                };
                reader.readAsDataURL(item.file);
                return;
            }
            resolve(item.url || null);
        });
    }

    // ─── COLOR TAGS STATE & HELPERS ───────────────────────────────────────
    function renderColorTags() {
        var container = document.getElementById('ap-color-tags-row');
        if (!container) return;

        container.querySelectorAll('.ap-color-tag').forEach(function (el) { el.remove(); });

        var addBtn = document.getElementById('ap-add-color-btn');

        colorList.forEach(function (colorName) {
            var tag = document.createElement('span');
            tag.className = 'ap-color-tag';
            tag.innerHTML =
                '<span class="ap-color-tag-name">' + escapeHtml(colorName) + '</span>' +
                '<button type="button" class="ap-color-tag-remove" data-color="' + escapeHtml(colorName) + '" aria-label="Remove color">&times;</button>';

            if (addBtn) {
                container.insertBefore(tag, addBtn);
            } else {
                container.appendChild(tag);
            }
        });

        container.querySelectorAll('.ap-color-tag-remove').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var c = this.getAttribute('data-color');
                colorList = colorList.filter(function (item) { return item !== c; });
                renderColorTags();
            });
        });
    }

    function initColorInput() {
        var addBtn = document.getElementById('ap-add-color-btn');
        var input = document.getElementById('ap-color-input');
        if (!addBtn || !input) return;

        addBtn.addEventListener('click', function () {
            addBtn.style.display = 'none';
            input.style.display = 'inline-block';
            input.focus();
        });

        function commitColor() {
            var val = input.value.trim().toUpperCase();
            if (val && colorList.indexOf(val) === -1) {
                colorList.push(val);
                renderColorTags();
            }
            input.value = '';
            input.style.display = 'none';
            addBtn.style.display = 'inline-block';
        }

        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                commitColor();
            } else if (e.key === 'Escape') {
                input.value = '';
                input.style.display = 'none';
                addBtn.style.display = 'inline-block';
            }
        });

        input.addEventListener('blur', function () {
            if (input.value.trim()) {
                commitColor();
            } else {
                input.style.display = 'none';
                addBtn.style.display = 'inline-block';
            }
        });
    }

    // ─── STOCK TOGGLE BUTTONS ──────────────────────────────────────────────
    function initStockToggle() {
        var btnInStock = document.getElementById('btn-in-stock');
        var btnPreOrder = document.getElementById('btn-pre-order');
        if (!btnInStock || !btnPreOrder) return;

        btnInStock.addEventListener('click', function () {
            btnInStock.classList.add('ap-stock-btn--active');
            btnPreOrder.classList.remove('ap-stock-btn--active');
        });

        btnPreOrder.addEventListener('click', function () {
            btnPreOrder.classList.add('ap-stock-btn--active');
            btnInStock.classList.remove('ap-stock-btn--active');
        });
    }

    // ─── VALIDATION ───────────────────────────────────────────────────────
    function clearErrors() {
        var errName = document.getElementById('ap-err-name');
        var errCategory = document.getElementById('ap-err-category');
        var errPrice = document.getElementById('ap-err-price');
        var inputName = document.getElementById('ap-input-name');
        var selectCategory = document.getElementById('ap-select-category');
        var inputPrice = document.getElementById('ap-input-price');

        [errName, errCategory, errPrice].forEach(function (el) {
            if (el) el.textContent = '';
        });
        [inputName, selectCategory, inputPrice].forEach(function (el) {
            if (el) el.classList.remove('ap-input--error');
        });
    }

    function validate() {
        clearErrors();
        var valid = true;

        var inputName = document.getElementById('ap-input-name');
        var errName = document.getElementById('ap-err-name');
        if (!inputName || !inputName.value.trim()) {
            if (errName) errName.textContent = 'Product name is required.';
            if (inputName) inputName.classList.add('ap-input--error');
            valid = false;
        }

        var selectCategory = document.getElementById('ap-select-category');
        var errCategory = document.getElementById('ap-err-category');
        if (!selectCategory || !selectCategory.value) {
            if (errCategory) errCategory.textContent = 'Please select a category.';
            if (selectCategory) selectCategory.classList.add('ap-input--error');
            valid = false;
        }

        var inputPrice = document.getElementById('ap-input-price');
        var errPrice = document.getElementById('ap-err-price');
        var price = inputPrice ? parseFloat(inputPrice.value) : NaN;
        if (!inputPrice || !inputPrice.value || isNaN(price) || price <= 0) {
            if (errPrice) errPrice.textContent = 'Enter a valid price.';
            if (inputPrice) inputPrice.classList.add('ap-input--error');
            valid = false;
        }

        return valid;
    }

    // ─── FORM DATA COLLECTION ─────────────────────────────────────────────
    function collectFormData() {
        var inputName = document.getElementById('ap-input-name');
        var selectCategory = document.getElementById('ap-select-category');
        var inputPrice = document.getElementById('ap-input-price');
        var inputStockQty = document.getElementById('ap-input-stock');
        var descTextarea = document.getElementById('ap-textarea-description');
        var compTextarea = document.getElementById('ap-textarea-composition');
        var careTextarea = document.getElementById('ap-textarea-care');
        var shipTextarea = document.getElementById('ap-textarea-shipping');

        var sizing = {};
        document.querySelectorAll('.ap-sizing-input').forEach(function (inp) {
            var measure = inp.getAttribute('data-measure');
            var size = inp.getAttribute('data-size');
            if (!sizing[measure]) sizing[measure] = {};
            sizing[measure][size] = parseFloat(inp.value) || 0;
        });

        var sizes = Array.from(document.querySelectorAll('.ap-size-checkbox:checked')).map(function (cb) {
            return cb.value;
        });

        return {
            title: inputName ? inputName.value.trim() : '',
            category: selectCategory ? selectCategory.value : '',
            price: parseFloat(inputPrice ? inputPrice.value : '0') || 0,
            stock: parseInt(inputStockQty ? inputStockQty.value : '0', 10) || 0,
            colors: colorList.slice(),
            sizes: sizes,
            description: descTextarea ? descTextarea.value.trim() : '',
            composition: compTextarea ? compTextarea.value.trim() : '',
            care_instructions: careTextarea ? careTextarea.value.trim() : '',
            shipping_info: shipTextarea ? shipTextarea.value.trim() : '',
            sizing_chart: sizing
        };
    }

    // ─── FETCH & PRE-FILL ─────────────────────────────────────────────────
    function fetchAndPreFillProduct(productId) {
        fetch(API_BASE_URL + '/api/products/' + productId, {
            method: 'GET',
            headers: getAuthHeaders()
        })
        .then(function (res) {
            if (!res.ok) {
                throw new Error('Product not found (status ' + res.status + ')');
            }
            return res.json();
        })
        .then(function (product) {
            populateForm(product);
        })
        .catch(function (err) {
            console.error('[EditProduct] Fetch error:', err);
            alert('Product not found or failed to load.');
            window.location.href = 'products';
        });
    }

    function populateForm(product) {
        if (!product) return;

        var inputName = document.getElementById('ap-input-name');
        if (inputName) inputName.value = product.title || product.name || '';

        var selectCategory = document.getElementById('ap-select-category');
        if (selectCategory && product.category) {
            selectCategory.value = product.category;
        }

        var inputPrice = document.getElementById('ap-input-price');
        if (inputPrice && product.price !== undefined) {
            inputPrice.value = product.price;
        }

        var inputStock = document.getElementById('ap-input-stock');
        if (inputStock && product.stock !== undefined) {
            inputStock.value = product.stock;
        }

        var btnInStock = document.getElementById('btn-in-stock');
        var btnPreOrder = document.getElementById('btn-pre-order');
        if (btnInStock && btnPreOrder) {
            if (product.stock > 0) {
                btnInStock.classList.add('ap-stock-btn--active');
                btnPreOrder.classList.remove('ap-stock-btn--active');
            }
        }

        if (Array.isArray(product.colors)) {
            colorList = product.colors.slice();
            renderColorTags();
        }

        if (Array.isArray(product.sizes)) {
            document.querySelectorAll('.ap-size-checkbox').forEach(function (cb) {
                cb.checked = product.sizes.indexOf(cb.value) !== -1;
            });
        }

        var descTextarea = document.getElementById('ap-textarea-description');
        if (descTextarea) descTextarea.value = product.description || '';

        var compTextarea = document.getElementById('ap-textarea-composition');
        if (compTextarea) compTextarea.value = product.composition || '';

        var careTextarea = document.getElementById('ap-textarea-care');
        if (careTextarea) careTextarea.value = product.care_instructions || '';

        var shipTextarea = document.getElementById('ap-textarea-shipping');
        if (shipTextarea) shipTextarea.value = product.shipping_info || '';

        if (product.sizing_chart) {
            document.querySelectorAll('.ap-sizing-input').forEach(function (inp) {
                var measure = inp.getAttribute('data-measure');
                var size = inp.getAttribute('data-size');
                if (product.sizing_chart[measure] && product.sizing_chart[measure][size] !== undefined) {
                    inp.value = product.sizing_chart[measure][size];
                } else if (product.sizing_chart[size] && product.sizing_chart[size][measure] !== undefined) {
                    inp.value = product.sizing_chart[size][measure];
                }
            });
        }

        if (product.image_url) {
            photoSlots[0] = product.image_url;
            updateSlotUI(0);
        }
    }

    // ─── SAVE / DELETE / CANCEL ACTIONS ──────────────────────────────────
    function setSaveLoading(loading) {
        var saveBtns = [document.getElementById('btn-save-top'), document.getElementById('btn-save-bottom')];
        saveBtns.forEach(function (btn) {
            if (!btn) return;
            btn.disabled = loading;
            btn.textContent = loading ? 'SAVING...' : 'SAVE CHANGES';
        });
    }

    function handleSave() {
        var productId = getProductId();
        if (!productId) {
            showFormError('Invalid product ID in URL.');
            return;
        }

        if (!validate()) {
            var firstError = document.querySelector('.ap-input--error');
            if (firstError) {
                firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }

        clearFormError();
        setSaveLoading(true);

        getImageUrl(photoSlots[0]).then(function (imageUrl) {
            var payload = collectFormData();
            if (imageUrl) {
                payload.image_url = imageUrl;
            }

            fetch(API_BASE_URL + '/api/products/' + productId, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            })
            .then(function (res) {
                if (!res.ok) {
                    return res.json().then(function (err) {
                        throw new Error((err && err.detail) || 'Failed to save changes.');
                    }).catch(function () {
                        throw new Error('Failed to save changes (status ' + res.status + ')');
                    });
                }
                return res.json();
            })
            .then(function () {
                setSaveLoading(false);
                alert('Product updated successfully.');
                window.location.href = 'products';
            })
            .catch(function (err) {
                setSaveLoading(false);
                showFormError(err.message || 'An error occurred while saving.');
            });
        });
    }

    function handleDelete() {
        var productId = getProductId();
        if (!productId) {
            showFormError('Invalid product ID.');
            return;
        }

        var inputName = document.getElementById('ap-input-name');
        var name = inputName ? inputName.value.trim() : 'this product';

        var confirmed = window.confirm('Are you sure you want to delete "' + (name || 'this product') + '"? This action cannot be undone.');
        if (!confirmed) return;

        fetch(API_BASE_URL + '/api/products/' + productId, {
            method: 'DELETE',
            headers: getAuthHeaders()
        })
        .then(function (res) {
            if (!res.ok) {
                return res.json().then(function (err) {
                    throw new Error((err && err.detail) || 'Failed to delete product.');
                }).catch(function () {
                    throw new Error('Failed to delete product (status ' + res.status + ')');
                });
            }
            alert('Product deleted successfully.');
            window.location.href = 'products';
        })
        .catch(function (err) {
            showFormError(err.message || 'Failed to delete product.');
        });
    }

    function initActionButtons() {
        var cancelTop = document.getElementById('btn-cancel-top');
        var cancelBottom = document.getElementById('btn-cancel-bottom');
        var deleteTop = document.getElementById('btn-delete-top');
        var deleteBottom = document.getElementById('btn-delete-bottom');
        var saveTop = document.getElementById('btn-save-top');
        var saveBottom = document.getElementById('btn-save-bottom');

        function goBack() {
            window.location.href = 'products';
        }

        if (cancelTop) cancelTop.addEventListener('click', goBack);
        if (cancelBottom) cancelBottom.addEventListener('click', goBack);

        if (deleteTop) deleteTop.addEventListener('click', handleDelete);
        if (deleteBottom) deleteBottom.addEventListener('click', handleDelete);

        if (saveTop) saveTop.addEventListener('click', handleSave);
        if (saveBottom) saveBottom.addEventListener('click', handleSave);
    }

    // ─── SIDEBAR TOGGLE ───────────────────────────────────────────────────
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

    // ─── BOOT ─────────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', function () {
        if (!guardAdmin()) return;

        initSidebarToggle();
        initPhotoUpload();
        initColorInput();
        initStockToggle();
        initActionButtons();

        // Initialize slot UI defaults
        for (var i = 0; i < MAX_SLOTS; i++) {
            updateSlotUI(i);
        }

        var productId = getProductId();
        if (!productId) {
            alert('No product ID provided in URL.');
            window.location.href = 'products';
            return;
        }

        fetchAndPreFillProduct(productId);
    });

})();

