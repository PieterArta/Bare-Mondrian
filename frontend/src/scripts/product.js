/**
 * Product page interactivity
 * - Wishlist heart icon toggle
 * - Load More button (visual only)
 */

document.addEventListener('DOMContentLoaded', () => {

  // ─── Wishlist Heart Toggle ───
  const wishlistBtns = document.querySelectorAll('.shop-wishlist-btn');
  wishlistBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.classList.toggle('active');
    });
  });

  // ─── Load More Button (visual feedback only) ───
  const loadMoreBtn = document.getElementById('load-more-btn');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      loadMoreBtn.style.opacity = '0.4';
      loadMoreBtn.style.pointerEvents = 'none';
      setTimeout(() => {
        loadMoreBtn.style.opacity = '';
        loadMoreBtn.style.pointerEvents = '';
      }, 1500);
    });
  }

});
