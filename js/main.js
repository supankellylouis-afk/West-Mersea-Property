/* ============================================================
   2 City Road — Main UI & Interaction
   ============================================================ */
(function () {
  'use strict';

  /* ---- Header scroll state ---- */
  const header = document.getElementById('site-header');
  function onScroll() {
    header.classList.toggle('scrolled', window.scrollY > 60);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---- Mobile nav ---- */
  const hamburger   = document.getElementById('hamburger');
  const mobileNav   = document.getElementById('mobile-nav');
  const mobileClose = document.getElementById('mobile-nav-close');
  const overlay     = document.getElementById('mobile-overlay');

  function openMobileNav() {
    mobileNav.classList.add('open');
    overlay.classList.add('visible');
    document.body.style.overflow = 'hidden';
  }
  function closeMobileNav() {
    mobileNav.classList.remove('open');
    overlay.classList.remove('visible');
    document.body.style.overflow = '';
  }

  hamburger.addEventListener('click', openMobileNav);
  mobileClose.addEventListener('click', closeMobileNav);
  overlay.addEventListener('click', closeMobileNav);

  document.querySelectorAll('.mobile-link').forEach(link => {
    link.addEventListener('click', closeMobileNav);
  });

  /* ---- Scroll-reveal animations ---- */
  const fadeEls = document.querySelectorAll('.fade-in');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  fadeEls.forEach(el => observer.observe(el));

  /* ---- Hero parallax ---- */
  const heroBg = document.querySelector('.hero-bg');
  if (heroBg) {
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      if (y < window.innerHeight) {
        heroBg.style.transform = `translateY(${y * 0.25}px) scale(1.04)`;
      }
    }, { passive: true });
    setTimeout(() => heroBg.classList.add('loaded'), 100);
  }

  /* ---- Gallery lightbox ---- */
  const lightbox    = document.getElementById('lightbox');
  const lbImg       = document.getElementById('lightbox-img');
  const lbCaption   = document.getElementById('lightbox-caption');
  const lbClose     = document.getElementById('lightbox-close');
  const lbPrev      = document.getElementById('lightbox-prev');
  const lbNext      = document.getElementById('lightbox-next');

  const galleryItems = Array.from(document.querySelectorAll('.gallery-item'));
  let currentGalleryIndex = 0;

  function openLightbox(index) {
    currentGalleryIndex = index;
    const item = galleryItems[index];
    const bg   = getComputedStyle(item).backgroundImage;
    const cap  = item.querySelector('.gallery-overlay span')?.textContent || '';
    lbImg.style.backgroundImage = bg;
    lbCaption.textContent = cap;
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
  }

  function nextLightbox() {
    openLightbox((currentGalleryIndex + 1) % galleryItems.length);
  }

  function prevLightbox() {
    openLightbox((currentGalleryIndex - 1 + galleryItems.length) % galleryItems.length);
  }

  galleryItems.forEach((item, i) => {
    item.addEventListener('click', () => openLightbox(i));
  });

  lbClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
  lbNext.addEventListener('click', nextLightbox);
  lbPrev.addEventListener('click', prevLightbox);

  document.addEventListener('keydown', e => {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape')      closeLightbox();
    if (e.key === 'ArrowRight')  nextLightbox();
    if (e.key === 'ArrowLeft')   prevLightbox();
  });

  /* ---- Smooth-scroll offset for fixed header ---- */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href').slice(1);
      if (!id) return;
      const target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });

  /* ---- Add fadeInUp keyframe for toasts ---- */
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeInUp {
      from { opacity:0; transform:translate(-50%, 12px); }
      to   { opacity:1; transform:translate(-50%, 0); }
    }
  `;
  document.head.appendChild(style);

  /* ---- Generate placeholder SVG images inline for demo ---- */
  /* In production these would be real photography */
  const PLACEHOLDERS = {
    'images/hero1.jpg':   generateSVGPlaceholder('#1e3a4a', '#2c6a5a', 'West Mersea Estuary'),
    'images/living.jpg':  generateSVGPlaceholder('#3a2e28', '#6a5a48', 'Living Room'),
    'images/kitchen.jpg': generateSVGPlaceholder('#2a2a22', '#5a5a42', 'Kitchen'),
    'images/master.jpg':  generateSVGPlaceholder('#1a2a3a', '#4a5a6a', 'Master Bedroom'),
    'images/garden.jpg':  generateSVGPlaceholder('#1a3020', '#3a6040', 'Garden Terrace'),
    'images/bath.jpg':    generateSVGPlaceholder('#2a3a3a', '#4a6a6a', 'Bathroom'),
  };

  function generateSVGPlaceholder(bg1, bg2, label) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${bg1}"/>
          <stop offset="100%" stop-color="${bg2}"/>
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#g)"/>
      <text x="400" y="280" text-anchor="middle" font-family="Georgia,serif"
        font-size="28" fill="rgba(255,255,255,0.5)" font-style="italic">${label}</text>
      <text x="400" y="320" text-anchor="middle" font-family="sans-serif"
        font-size="13" fill="rgba(255,255,255,0.3)" letter-spacing="3">2 CITY ROAD · WEST MERSEA</text>
    </svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }

  /* Apply placeholders where image files aren't found */
  function applyPlaceholders() {
    /* Background-image elements */
    document.querySelectorAll('[style*="background-image"]').forEach(el => {
      const style = el.getAttribute('style') || '';
      const match = style.match(/url\(['"]?(images\/[^'")\s]+)['"]?\)/);
      if (match) {
        const path = match[1];
        if (PLACEHOLDERS[path]) {
          el.style.backgroundImage = `url('${PLACEHOLDERS[path]}')`;
        }
      }
    });

    /* CSS background on hero-bg — inject fallback */
    const heroBg = document.querySelector('.hero-bg');
    if (heroBg) {
      heroBg.style.backgroundImage = `url('${PLACEHOLDERS['images/hero1.jpg']}')`;
    }

    /* CTA banner */
    const ctaBg = document.querySelector('.cta-banner-bg');
    if (ctaBg) {
      ctaBg.style.backgroundImage = `url('${PLACEHOLDERS['images/garden.jpg']}'), linear-gradient(135deg, #1a2a3a, #2c4a3e)`;
    }
  }

  applyPlaceholders();

})();
