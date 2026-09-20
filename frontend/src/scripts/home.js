// home.js — Homepage Featured Products API Integration

(function initFeaturedProducts() {
    // ─── Config ────────────────────────────────────────────────────────────
    var API_BASE_URL = 'https://bare-mondrian.onrender.com';

    // ─── Element refs ──────────────────────────────────────────────────────
    var section = document.getElementById('featured-products-section');
    var header  = document.getElementById('featured-section-header');
    var grid    = document.getElementById('featured-products-grid');

    // Only run on the home page
    if (!section || !grid) return;

    // ─── Helpers ───────────────────────────────────────────────────────────

    /** Format a number as IDR Rupiah, e.g. "Rp 3.500.000" */
    function formatRupiah(value) {
        var num = Math.round(Number(value));
        return 'Rp ' + num.toLocaleString('id-ID');
    }

    /** Escape a string for safe use inside an HTML attribute */
    function escapeAttr(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    // ─── Loading state (skeleton cards) ────────────────────────────────────
    function showSkeleton() {
        var html = '';
        for (var i = 0; i < 3; i++) {
            html += '<div class="product-card product-card--skeleton" aria-hidden="true"></div>';
        }
        grid.innerHTML = html;
    }

    // ─── Empty state ────────────────────────────────────────────────────────
    function showEmpty() {
        // Hide the whole section (header + grid) when nothing is featured
        section.style.display = 'none';
    }

    // ─── Card builder ──────────────────────────────────────────────────────
    function buildCard(product, index) {
        var href      = '/product-detail?id=' + product.id;
        var ariaLabel = escapeAttr(product.title);
        var imgHTML;

        if (product.image_url) {
            // Primary image; on error swap to a neutral placeholder background
            imgHTML =
                '<img src="' + escapeAttr(product.image_url) + '" ' +
                'alt="' + ariaLabel + '" ' +
                'class="product-card-image" ' +
                'onerror="this.style.display=\'none\'">';
        } else {
            // No image_url — render a solid placeholder block
            imgHTML = '<div class="product-card-image" style="background:#f0f0f0;width:100%;height:100%;"></div>';
        }

        return '<a href="' + href + '" class="product-card" ' +
               'id="featured-card-' + product.id + '" ' +
               'aria-label="' + ariaLabel + '">' +
               imgHTML +
               '<div class="product-card-overlay">' +
               '<span class="product-card-cta">VIEW PRODUCT</span>' +
               '</div>' +
               '<div class="product-card-info">' +
               '<span class="product-card-name">' + escapeAttr(product.title.toUpperCase()) + '</span>' +
               '<span class="product-card-price">' + formatRupiah(product.price) + '</span>' +
               '</div>' +
               '</a>';
    }

    // ─── Render ────────────────────────────────────────────────────────────
    function renderFeatured(products) {
        if (!products || products.length === 0) {
            showEmpty();
            return;
        }

        var html = '';
        for (var i = 0; i < products.length; i++) {
            html += buildCard(products[i], i);
        }
        grid.innerHTML = html;
    }

    // ─── Fetch ─────────────────────────────────────────────────────────────
    function fetchFeaturedProducts() {
        showSkeleton();

        fetch(API_BASE_URL + '/api/homepage/featured-products')
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (data) {
                var products = Array.isArray(data) ? data : (data.products || []);
                renderFeatured(products);
            })
            .catch(function (err) {
                console.error('[Home] Failed to load featured products:', err);
                // On error: quietly hide the section so the page doesn't break
                section.style.display = 'none';
            });
    }

    // ─── Boot ──────────────────────────────────────────────────────────────
    fetchFeaturedProducts();
})();
