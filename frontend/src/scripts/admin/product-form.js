/**
 * product-form.js — BARE MONDRIAN Admin
 * Add New Product form logic: auth guard, photo upload previews,
 * form collection & validation, API submission (POST /api/products/), loading state,
 * error handling, and cancel navigation.
 */
(function () {
    'use strict';

    var API_BASE_URL = 'https://bare-mondrian.onrender.com';
    var MAX_SLOTS = 3;

    // State
    var photoSlots = [null, null, null]; // ObjectURL or null per slot
    var colorTags = ['ESPRESSO', 'OBSIDIAN'];
    var stockStatus = 'IN STOCK';

    /* -------------------------------------------------------
       1. AUTH GUARD
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
        var headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = 'Bearer ' + token;
        }
        return headers;
    }

    /* -------------------------------------------------------
       2. UI HELPERS & ERROR BANNER
       ------------------------------------------------------- */
    function showFormError(message) {
        var errorEl = document.getElementById('ap-form-error');
        if (!errorEl) {
            errorEl = document.createElement('div');
            errorEl.id = 'ap-form-error';
            errorEl.style.cssText =
                'color:#c0392b;background:#fdf0ed;border:1px solid #f5c6cb;padding:12px 16px;margin-bottom:20px;font-size:0.85rem;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;';
            var form = document.getElementById('add-product-form');
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

    /* -------------------------------------------------------
       3. PHOTO UPLOAD & PREVIEWS
       ------------------------------------------------------- */
    function updateSlotUI(slotIndex) {
        var src   = photoSlots[slotIndex];
        var img   = document.getElementById('ap-slot-img-' + slotIndex);
        var ph    = document.getElementById('ap-slot-ph-' + slotIndex);
        var label = document.getElementById('ap-main-label-' + slotIndex);
        var rmBtn = document.getElementById('ap-slot-rm-' + slotIndex);

        if (!img || !ph) return;

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
            var slotIdx = photoSlots.indexOf(null);
            if (slotIdx === -1) return;

            var allowed = ['image/jpeg', 'image/png', 'image/webp'];
            if (!allowed.includes(file.type)) return;
            if (file.size > 5 * 1024 * 1024) {
                alert(file.name + ' exceeds 5 MB and was skipped.');
                return;
            }

            var url = URL.createObjectURL(file);
            photoSlots[slotIdx] = url;
            updateSlotUI(slotIdx);
        });
    }

    function removePhoto(slotIndex) {
        if (photoSlots[slotIndex]) {
            if (typeof photoSlots[slotIndex] === 'string' && photoSlots[slotIndex].indexOf('blob:') === 0) {
                URL.revokeObjectURL(photoSlots[slotIndex]);
            }
            photoSlots[slotIndex] = null;
        }
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

    /* -------------------------------------------------------
       4. STOCK TOGGLE & COLOR TAGS
       ------------------------------------------------------- */
    function initStockToggle() {
        var stockToggle = document.getElementById('ap-stock-toggle');
        if (!stockToggle) return;
        stockToggle.querySelectorAll('.ap-stock-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                stockStatus = btn.getAttribute('data-status');
                stockToggle.querySelectorAll('.ap-stock-btn').forEach(function (b) {
                    b.classList.toggle('ap-stock-btn--active', b === btn);
                });
            });
        });
    }

    function renderColorTags() {
        var container = document.getElementById('ap-color-tags-row');
        var addBtn = document.getElementById('ap-add-color-btn');
        if (!container) return;

        container.querySelectorAll('.ap-color-tag').forEach(function (el) { el.remove(); });

        colorTags.forEach(function (color, index) {
            var tag = document.createElement('span');
            tag.className = 'ap-color-tag';
            tag.innerHTML =
                color +
                ' <button type="button" class="ap-color-tag-remove" aria-label="Remove ' + color + '" data-index="' + index + '">&times;</button>';
            if (addBtn) {
                container.insertBefore(tag, addBtn);
            } else {
                container.appendChild(tag);
            }
        });

        container.querySelectorAll('.ap-color-tag-remove').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var idx = parseInt(btn.getAttribute('data-index'), 10);
                colorTags.splice(idx, 1);
                renderColorTags();
            });
        });
    }

    function initColorTags() {
        var addBtn = document.getElementById('ap-add-color-btn');
        var colorInput = document.getElementById('ap-color-input');
        if (!addBtn || !colorInput) return;

        renderColorTags();

        addBtn.addEventListener('click', function () {
            addBtn.style.display = 'none';
            colorInput.style.display  = 'inline-block';
            colorInput.value = '';
            colorInput.focus();
        });

        function commitColor() {
            var val = colorInput.value.trim().toUpperCase();
            if (val && !colorTags.includes(val)) {
                colorTags.push(val);
            }
            colorInput.style.display = 'none';
            addBtn.style.display = 'inline-flex';
            renderColorTags();
        }

        colorInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); commitColor(); }
            if (e.key === 'Escape') {
                colorInput.style.display = 'none';
                addBtn.style.display = 'inline-flex';
            }
        });
        colorInput.addEventListener('blur', commitColor);
    }

    /* -------------------------------------------------------
       5. VALIDATION
       ------------------------------------------------------- */
    function clearFieldErrors() {
        var errName = document.getElementById('ap-err-name');
        var errCategory = document.getElementById('ap-err-category');
        var errPrice = document.getElementById('ap-err-price');
        var inputName = document.getElementById('ap-input-name');
        var selectCategory = document.getElementById('ap-select-category');
        var inputPrice = document.getElementById('ap-input-price');

        [errName, errCategory, errPrice].forEach(function (el) { if (el) el.textContent = ''; });
        [inputName, selectCategory, inputPrice].forEach(function (el) {
            if (el) el.classList.remove('ap-input--error');
        });
    }

    function validateForm() {
        clearFieldErrors();
        clearFormError();
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
            if (errPrice) errPrice.textContent = 'Enter a valid price greater than 0.';
            if (inputPrice) inputPrice.classList.add('ap-input--error');
            valid = false;
        }

        return valid;
    }

    /* -------------------------------------------------------
       6. COLLECT FORM DATA & SUBMIT TO BACKEND
       ------------------------------------------------------- */
    function collectFormData() {
        var inputName       = document.getElementById('ap-input-name');
        var selectCategory  = document.getElementById('ap-select-category');
        var inputPrice      = document.getElementById('ap-input-price');
        var inputStockQty   = document.getElementById('ap-input-stock');
        var descTextarea    = document.getElementById('ap-textarea-description');
        var compTextarea    = document.getElementById('ap-textarea-composition');
        var careTextarea    = document.getElementById('ap-textarea-care');
        var shipTextarea    = document.getElementById('ap-textarea-shipping');

        // Sizing chart: {"S/M": {bust: X, ...}, "L/XL": {bust: Y, ...}}
        var sizingChart = {};
        document.querySelectorAll('.ap-sizing-input').forEach(function (inp) {
            var measure   = inp.getAttribute('data-measure');
            var rawSize   = inp.getAttribute('data-size');
            var sizeGroup = (rawSize === 'sm') ? 'S/M' : (rawSize === 'lxl' ? 'L/XL' : rawSize);
            var val       = parseFloat(inp.value) || 0;

            if (!sizingChart[sizeGroup]) sizingChart[sizeGroup] = {};
            sizingChart[sizeGroup][measure] = val;
        });

        // Selected sizes
        var sizes = Array.from(document.querySelectorAll('.ap-size-checkbox:checked')).map(function (cb) {
            return cb.value;
        });

        // Determine image URL (use slot 0 photo if present, otherwise default placeholder)
        var imageUrl = photoSlots[0] || '/assets/images/products/structure-02-wht.jpg';

        return {
            title:             inputName ? inputName.value.trim() : '',
            category:          selectCategory ? selectCategory.value : '',
            price:             parseFloat(inputPrice ? inputPrice.value : '0') || 0,
            stock:             parseInt(inputStockQty ? inputStockQty.value : '0', 10) || 0,
            colors:            colorTags.slice(),
            sizes:             sizes,
            image_url:         imageUrl,
            description:       descTextarea ? descTextarea.value.trim() : '',
            composition:       compTextarea ? compTextarea.value.trim() : '',
            care_instructions: careTextarea ? careTextarea.value.trim() : '',
            shipping_info:     shipTextarea ? shipTextarea.value.trim() : '',
            sizing_chart:      sizingChart
        };
    }

    function setSaveLoading(loading) {
        var saveBtns = [document.getElementById('btn-save-top'), document.getElementById('btn-save-bottom')];
        saveBtns.forEach(function (btn) {
            if (!btn) return;
            btn.disabled = loading;
            btn.textContent = loading ? 'SAVING...' : 'SAVE PRODUCT';
        });
    }

    function handleSave() {
        if (!validateForm()) {
            var firstError = document.querySelector('.ap-input--error');
            if (firstError) {
                firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }

        var payload = collectFormData();
        setSaveLoading(true);

        fetch(API_BASE_URL + '/api/products/', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        })
        .then(function (res) {
            if (!res.ok) {
                return res.json().then(function (err) {
                    throw new Error((err && err.detail) || 'Failed to create product.');
                }).catch(function () {
                    throw new Error('Failed to create product (status ' + res.status + ')');
                });
            }
            return res.json();
        })
        .then(function (newProduct) {
            setSaveLoading(false);
            alert('Product created successfully!');
            window.location.href = 'products';
        })
        .catch(function (err) {
            setSaveLoading(false);
            showFormError(err.message || 'An error occurred while saving the product.');
        });
    }

    function handleCancel() {
        var confirmed = window.confirm('Discard changes and go back to Product Management?');
        if (confirmed) {
            window.location.href = 'products';
        }
    }

    function initActionButtons() {
        var saveTop      = document.getElementById('btn-save-top');
        var saveBottom   = document.getElementById('btn-save-bottom');
        var cancelTop    = document.getElementById('btn-cancel-top');
        var cancelBottom = document.getElementById('btn-cancel-bottom');

        if (saveTop) saveTop.addEventListener('click', handleSave);
        if (saveBottom) saveBottom.addEventListener('click', handleSave);
        if (cancelTop) cancelTop.addEventListener('click', handleCancel);
        if (cancelBottom) cancelBottom.addEventListener('click', handleCancel);
    }

    /* -------------------------------------------------------
       7. MOBILE SIDEBAR TOGGLE
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
       8. BOOT
       ------------------------------------------------------- */
    document.addEventListener('DOMContentLoaded', function () {
        if (!guardAdmin()) return;

        initPhotoUpload();
        initStockToggle();
        initColorTags();
        initActionButtons();
        initSidebarToggle();

        for (var i = 0; i < MAX_SLOTS; i++) {
            updateSlotUI(i);
        }
    });

})();
