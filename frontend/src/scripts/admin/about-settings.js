/**
 * about-settings.js — BARE MONDRIAN Admin
 * Manage About Us page content: 4:3 aspect ratio image (Cropper.js + Cloudinary upload) + Paragraph 1 & 2.
 */

'use strict';

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
    var role = localStorage.getItem('role');
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
var loadedState = {
    paragraph_1: '',
    paragraph_2: '',
    image_url: null
};

// Pending image URL set after Cloudinary upload but before form save
var pendingImageUrl = null;

// DOM refs resolved in DOMContentLoaded
var p1Input, p2Input, errP1, errP2, statusMsg, btnCancel, btnSave, form;
var imgPreview, imgPlaceholder, imgUploading, imgRemoveBtn, imgFileInput, imgDropzone;

// Cropper instance
var activeCropper = null;

/* -------------------------------------------------------
   STATUS HELPERS
   ------------------------------------------------------- */
function showStatus(msg, isError) {
    if (!statusMsg) return;
    statusMsg.textContent = msg;
    statusMsg.style.display = 'block';
    statusMsg.style.backgroundColor = isError ? '#fce8e6' : '#e6f4ea';
    statusMsg.style.color = isError ? '#c0392b' : '#1e7e34';
    statusMsg.style.border = isError ? '1px solid #f5c6cb' : '1px solid #c3e6cb';
}

function hideStatus() {
    if (statusMsg) {
        statusMsg.style.display = 'none';
        statusMsg.textContent = '';
    }
}

function clearErrors() {
    if (errP1) { errP1.textContent = ''; errP1.style.display = 'none'; }
    if (errP2) { errP2.textContent = ''; errP2.style.display = 'none'; }
    hideStatus();
}

/* -------------------------------------------------------
   IMAGE PREVIEW UI
   ------------------------------------------------------- */
function setImagePreview(url) {
    if (!imgPreview) return;
    if (url) {
        imgPreview.src = url;
        imgPreview.style.display = 'block';
        if (imgPlaceholder) imgPlaceholder.style.display = 'none';
        if (imgRemoveBtn) imgRemoveBtn.style.display = 'inline-flex';
    } else {
        imgPreview.src = '';
        imgPreview.style.display = 'none';
        if (imgPlaceholder) imgPlaceholder.style.display = 'flex';
        if (imgRemoveBtn) imgRemoveBtn.style.display = 'none';
    }
}

function setImageUploading(isLoading) {
    if (imgUploading) imgUploading.style.display = isLoading ? 'flex' : 'none';
}

/* -------------------------------------------------------
   CROPPER & UPLOAD FLOW
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

function handleFileSelection(file) {
    var allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
        showStatus('Only JPEG, PNG, or WEBP images are accepted.', true);
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        showStatus(file.name + ' exceeds 5 MB limit.', true);
        return;
    }

    var overlay = document.getElementById('crop-modal-overlay');
    var imgEl = document.getElementById('crop-modal-img');
    var confirmBtn = document.getElementById('crop-modal-confirm');
    var cancelBtn = document.getElementById('crop-modal-cancel');
    var closeBtn = document.getElementById('crop-modal-close');

    if (!overlay || !imgEl || typeof Cropper === 'undefined') {
        // Fallback to direct upload if Cropper or modal HTML is absent
        uploadAboutImage(file);
        return;
    }

    var reader = new FileReader();
    reader.onload = function (e) {
        imgEl.src = e.target.result;
        overlay.style.display = 'flex';

        if (activeCropper) {
            activeCropper.destroy();
        }

        // Initialize Cropper.js with 4:3 landscape ratio (specifically for About Us image)
        activeCropper = new Cropper(imgEl, {
            aspectRatio: 4 / 3,
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
                maxWidth: 1600,
                maxHeight: 1200
            }).toBlob(function (blob) {
                if (!blob) {
                    showStatus('Failed to crop image', true);
                    return;
                }

                var croppedFile = new File([blob], file.name, {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                });

                closeCropModal();
                uploadAboutImage(croppedFile);
            }, 'image/jpeg', 0.9);
        };

        cancelBtn.onclick = function () {
            closeCropModal();
        };

        closeBtn.onclick = function () {
            closeCropModal();
        };
    };

    reader.readAsDataURL(file);
}

function uploadAboutImage(file) {
    setImageUploading(true);

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
        if (!res.ok) throw new Error('Upload failed (status ' + res.status + ')');
        return res.json();
    })
    .then(function (data) {
        setImageUploading(false);
        pendingImageUrl = data.url;
        setImagePreview(pendingImageUrl);
    })
    .catch(function (err) {
        setImageUploading(false);
        console.error('[AboutSettings] Image upload error:', err);
        showStatus('Image upload failed. Please try again.', true);
    });
}

/* -------------------------------------------------------
   FETCH & RENDER
   ------------------------------------------------------- */
function fetchAboutContent() {
    fetch(API_BASE_URL + '/api/about-us')
        .then(function (res) {
            if (!res.ok) throw new Error('Failed to load About Us content');
            return res.json();
        })
        .then(function (data) {
            if (!data) return;
            loadedState.paragraph_1 = data.paragraph_1 || '';
            loadedState.paragraph_2 = data.paragraph_2 || '';
            loadedState.image_url = data.image_url || null;

            if (p1Input) p1Input.value = loadedState.paragraph_1;
            if (p2Input) p2Input.value = loadedState.paragraph_2;

            // Show existing image — but do NOT set pendingImageUrl here.
            // pendingImageUrl is only set when the user uploads a NEW image.
            // handleSave() will fall back to loadedState.image_url when pendingImageUrl is null.
            setImagePreview(loadedState.image_url);
        })
        .catch(function (err) {
            console.error('[AboutSettings] Fetch error:', err);
            showStatus('Failed to load current content. ' + err.message, true);
        });
}

/* -------------------------------------------------------
   SAVE & CANCEL ACTIONS
   ------------------------------------------------------- */
function handleSave() {
    clearErrors();

    var val1 = p1Input ? p1Input.value.trim() : '';
    var val2 = p2Input ? p2Input.value.trim() : '';

    var hasError = false;
    if (!val1) {
        if (errP1) { errP1.textContent = 'Paragraph 1 cannot be empty.'; errP1.style.display = 'block'; }
        hasError = true;
    }
    if (!val2) {
        if (errP2) { errP2.textContent = 'Paragraph 2 cannot be empty.'; errP2.style.display = 'block'; }
        hasError = true;
    }
    if (hasError) return;

    if (btnSave) {
        btnSave.disabled = true;
        btnSave.textContent = 'SAVING...';
    }

    // Use the newly uploaded URL if available; otherwise keep the existing saved image.
    // pendingImageUrl is null until the user explicitly uploads a new photo.
    var imageUrlToSave = pendingImageUrl !== null ? pendingImageUrl : loadedState.image_url;

    fetch(API_BASE_URL + '/api/about-us', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
            paragraph_1: val1,
            paragraph_2: val2,
            image_url: imageUrlToSave || null
        })
    })
    .then(function (res) {
        if (res.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('role');
            window.location.href = '../pages/login';
            return;
        }
        if (!res.ok) {
            return res.json().then(function (err) {
                throw new Error((err && err.detail) || 'Failed to update About Us content');
            }).catch(function () {
                throw new Error('Update failed (status ' + res.status + ')');
            });
        }
        return res.json();
    })
    .then(function (data) {
        if (!data) return;
        if (btnSave) {
            btnSave.disabled = false;
            btnSave.textContent = 'SAVE CHANGES';
        }
        loadedState.paragraph_1 = data.paragraph_1 || val1;
        loadedState.paragraph_2 = data.paragraph_2 || val2;
        loadedState.image_url = data.image_url || null;
        pendingImageUrl = loadedState.image_url;

        if (p1Input) p1Input.value = loadedState.paragraph_1;
        if (p2Input) p2Input.value = loadedState.paragraph_2;
        setImagePreview(loadedState.image_url);

        showStatus('About Us page updated successfully!', false);
    })
    .catch(function (err) {
        if (btnSave) {
            btnSave.disabled = false;
            btnSave.textContent = 'SAVE CHANGES';
        }
        console.error('[AboutSettings] Update error:', err);
        showStatus(err.message || 'Failed to update About Us content.', true);
    });
}

function handleCancel() {
    clearErrors();
    if (p1Input) p1Input.value = loadedState.paragraph_1;
    if (p2Input) p2Input.value = loadedState.paragraph_2;
    // Discard any in-progress upload; revert preview to the last saved image
    pendingImageUrl = null;
    setImagePreview(loadedState.image_url);
}

/* -------------------------------------------------------
   IMAGE REMOVE
   ------------------------------------------------------- */
function handleRemoveImage() {
    pendingImageUrl = null;
    setImagePreview(null);
}

/* -------------------------------------------------------
   IMAGE DROPZONE INIT
   ------------------------------------------------------- */
function initImageUpload() {
    imgFileInput = document.getElementById('about-img-file-input');
    imgDropzone  = document.getElementById('about-img-dropzone');
    imgPreview   = document.getElementById('about-img-preview');
    imgPlaceholder = document.getElementById('about-img-placeholder');
    imgUploading = document.getElementById('about-img-uploading');
    imgRemoveBtn = document.getElementById('about-img-remove-btn');

    if (!imgFileInput || !imgDropzone) return;

    imgDropzone.addEventListener('click', function (e) {
        if (e.target !== imgFileInput) imgFileInput.click();
    });

    imgDropzone.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); imgFileInput.click(); }
    });

    imgFileInput.addEventListener('change', function () {
        if (imgFileInput.files && imgFileInput.files.length > 0) {
            handleFileSelection(imgFileInput.files[0]);
        }
        imgFileInput.value = '';
    });

    imgDropzone.addEventListener('dragover', function (e) {
        e.preventDefault();
        imgDropzone.classList.add('dragover');
    });
    imgDropzone.addEventListener('dragleave', function () {
        imgDropzone.classList.remove('dragover');
    });
    imgDropzone.addEventListener('drop', function (e) {
        e.preventDefault();
        imgDropzone.classList.remove('dragover');
        if (e.dataTransfer && e.dataTransfer.files.length > 0) {
            handleFileSelection(e.dataTransfer.files[0]);
        }
    });

    if (imgRemoveBtn) {
        imgRemoveBtn.addEventListener('click', handleRemoveImage);
    }
}

/* -------------------------------------------------------
   MOBILE SIDEBAR TOGGLE
   ------------------------------------------------------- */
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

/* -------------------------------------------------------
   BOOT
   ------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', function () {
    if (!guardAdmin()) return;

    p1Input   = document.getElementById('about-paragraph-1');
    p2Input   = document.getElementById('about-paragraph-2');
    errP1     = document.getElementById('err-paragraph-1');
    errP2     = document.getElementById('err-paragraph-2');
    statusMsg = document.getElementById('about-status-message');
    btnCancel = document.getElementById('btn-about-cancel');
    btnSave   = document.getElementById('btn-about-save');
    form      = document.getElementById('about-settings-form');

    initImageUpload();
    fetchAboutContent();

    if (btnSave)   btnSave.addEventListener('click', handleSave);
    if (btnCancel) btnCancel.addEventListener('click', handleCancel);
    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            handleSave();
        });
    }

    initSidebarToggle();
});
