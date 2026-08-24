/**
 * add-product.js — BARE MONDRIAN Admin
 * Add New Product form: photo upload, color tags, stock toggle,
 * form collection, validation, and save/cancel.
 */
'use strict';

/* -------------------------------------------------------
   PHOTO SLOTS STATE
   ------------------------------------------------------- */
var MAX_SLOTS = 3;
var photoSlots = [null, null, null]; // ObjectURL or null per slot

/* -------------------------------------------------------
   COLOR TAGS STATE
   ------------------------------------------------------- */
var colorTags = ['ESPRESSO', 'OBSIDIAN'];

/* -------------------------------------------------------
   STOCK STATUS STATE
   ------------------------------------------------------- */
var stockStatus = 'IN STOCK';

/* -------------------------------------------------------
   DOM REFERENCES
   ------------------------------------------------------- */
var dropzone        = document.getElementById('ap-dropzone');
var fileInput       = document.getElementById('ap-file-input');
var photoSlotsEl    = document.getElementById('ap-photo-slots');

var inputName       = document.getElementById('ap-input-name');
var selectCategory  = document.getElementById('ap-select-category');
var inputPrice      = document.getElementById('ap-input-price');
var inputStockQty   = document.getElementById('ap-input-stock');
var stockToggle     = document.getElementById('ap-stock-toggle');

var colorTagsRow    = document.getElementById('ap-color-tags-row');
var addColorBtn     = document.getElementById('ap-add-color-btn');
var colorInput      = document.getElementById('ap-color-input');

var errName         = document.getElementById('ap-err-name');
var errCategory     = document.getElementById('ap-err-category');
var errPrice        = document.getElementById('ap-err-price');

/* -------------------------------------------------------
   1. PHOTO UPLOAD
   ------------------------------------------------------- */
function updateSlotUI(slotIndex) {
    var src    = photoSlots[slotIndex];
    var img    = document.getElementById('ap-slot-img-'    + slotIndex);
    var ph     = document.getElementById('ap-slot-ph-'     + slotIndex);
    var label  = document.getElementById('ap-main-label-'  + slotIndex);
    var rmBtn  = document.getElementById('ap-slot-rm-'     + slotIndex);

    if (src) {
        img.src = src;
        img.style.display = 'block';
        ph.style.display  = 'none';
        if (rmBtn) rmBtn.style.display = 'flex';
        // Main photo label only on slot 0
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
        // Find first empty slot
        var slotIdx = photoSlots.indexOf(null);
        if (slotIdx === -1) return; // All slots full

        // Validate
        var allowed = ['image/jpeg', 'image/png'];
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
        URL.revokeObjectURL(photoSlots[slotIndex]);
        photoSlots[slotIndex] = null;
    }
    updateSlotUI(slotIndex);
}

function initPhotoUpload() {
    // File input change
    fileInput.addEventListener('change', function () {
        if (fileInput.files && fileInput.files.length) {
            addPhotos(fileInput.files);
        }
        fileInput.value = ''; // reset so same file can be re-selected
    });

    // Dropzone drag events
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

    // Keyboard on dropzone
    dropzone.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
    });

    // Remove buttons on each slot
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
   2. STOCK STATUS TOGGLE
   ------------------------------------------------------- */
function initStockToggle() {
    stockToggle.querySelectorAll('.ap-stock-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            stockStatus = btn.getAttribute('data-status');
            stockToggle.querySelectorAll('.ap-stock-btn').forEach(function (b) {
                b.classList.toggle('ap-stock-btn--active', b === btn);
            });
        });
    });
}

/* -------------------------------------------------------
   3. COLOR TAGS
   ------------------------------------------------------- */
function renderColorTags() {
    // Remove existing tags (keep the add-btn and input at the end)
    var existing = colorTagsRow.querySelectorAll('.ap-color-tag');
    existing.forEach(function (el) { el.remove(); });

    // Insert tags before the add-btn
    colorTags.forEach(function (color, index) {
        var tag = document.createElement('span');
        tag.className = 'ap-color-tag';
        tag.innerHTML =
            color +
            ' <button type="button" class="ap-color-tag-remove" aria-label="Remove ' + color + '" data-index="' + index + '">&times;</button>';
        colorTagsRow.insertBefore(tag, addColorBtn);
    });

    // Bind remove buttons
    colorTagsRow.querySelectorAll('.ap-color-tag-remove').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var idx = parseInt(btn.getAttribute('data-index'), 10);
            colorTags.splice(idx, 1);
            renderColorTags();
        });
    });
}

function initColorTags() {
    renderColorTags();

    // Show input on "+ ADD COLOR" click
    addColorBtn.addEventListener('click', function () {
        addColorBtn.style.display = 'none';
        colorInput.style.display  = 'inline-block';
        colorInput.value = '';
        colorInput.focus();
    });

    // Confirm on Enter or blur
    function commitColor() {
        var val = colorInput.value.trim().toUpperCase();
        if (val && !colorTags.includes(val)) {
            colorTags.push(val);
        }
        colorInput.style.display = 'none';
        addColorBtn.style.display = 'inline-flex';
        renderColorTags();
    }

    colorInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); commitColor(); }
        if (e.key === 'Escape') {
            colorInput.style.display = 'none';
            addColorBtn.style.display = 'inline-flex';
        }
    });
    colorInput.addEventListener('blur', commitColor);
}

/* -------------------------------------------------------
   4. VALIDATION
   ------------------------------------------------------- */
function clearErrors() {
    [errName, errCategory, errPrice].forEach(function (el) { el.textContent = ''; });
    [inputName, selectCategory, inputPrice].forEach(function (el) {
        el.classList.remove('ap-input--error');
    });
}

function validate() {
    clearErrors();
    var valid = true;

    if (!inputName.value.trim()) {
        errName.textContent = 'Product name is required.';
        inputName.classList.add('ap-input--error');
        valid = false;
    }
    if (!selectCategory.value) {
        errCategory.textContent = 'Please select a category.';
        selectCategory.classList.add('ap-input--error');
        valid = false;
    }
    var price = parseFloat(inputPrice.value);
    if (!inputPrice.value || isNaN(price) || price <= 0) {
        errPrice.textContent = 'Enter a valid price.';
        inputPrice.classList.add('ap-input--error');
        valid = false;
    }

    return valid;
}

/* -------------------------------------------------------
   5. COLLECT FORM DATA
   ------------------------------------------------------- */
function collectFormData() {
    // Sizing table
    var sizing = {};
    document.querySelectorAll('.ap-sizing-input').forEach(function (inp) {
        var measure = inp.getAttribute('data-measure');
        var size    = inp.getAttribute('data-size');
        if (!sizing[measure]) sizing[measure] = {};
        sizing[measure][size] = parseFloat(inp.value) || 0;
    });

    // Sizes checked
    var sizes = Array.from(document.querySelectorAll('.ap-size-checkbox:checked')).map(function (cb) {
        return cb.value;
    });

    return {
        name:        inputName.value.trim(),
        category:    selectCategory.value,
        price:       parseFloat(inputPrice.value) || 0,
        stockQty:    parseInt(inputStockQty.value, 10) || 0,
        stockStatus: stockStatus,
        colors:      colorTags.slice(),
        sizes:       sizes,
        description: document.getElementById('ap-textarea-description').value.trim(),
        sizing:      sizing,
        material:    document.getElementById('ap-textarea-material').value.trim(),
        shipping:    document.getElementById('ap-textarea-shipping').value.trim(),
        photos:      photoSlots.filter(Boolean)
    };
}

/* -------------------------------------------------------
   6. SAVE / CANCEL
   ------------------------------------------------------- */
function handleSave() {
    if (!validate()) {
        // Scroll to first error
        var firstError = document.querySelector('.ap-input--error');
        if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    var data = collectFormData();

    // TODO: replace with API call — POST /api/products
    console.log('[Add Product] Saving product (dummy):', data);
    alert('Product saved! (dummy — not yet connected to backend)\n\nSee console for collected data.');

    // Navigate back to list
    window.location.href = 'products.html';
}

function handleCancel() {
    var confirmed = window.confirm('Discard changes and go back to Product Management?');
    if (confirmed) {
        window.location.href = 'products.html';
    }
}

function initActions() {
    document.getElementById('btn-save-top').addEventListener('click', handleSave);
    document.getElementById('btn-save-bottom').addEventListener('click', handleSave);
    document.getElementById('btn-cancel-top').addEventListener('click', handleCancel);
    document.getElementById('btn-cancel-bottom').addEventListener('click', handleCancel);
}

/* -------------------------------------------------------
   BOOT
   ------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', function () {
    initPhotoUpload();
    initStockToggle();
    initColorTags();
    initActions();

    // Initialise all slot UIs (all empty on fresh load)
    for (var i = 0; i < MAX_SLOTS; i++) {
        updateSlotUI(i);
    }
});
