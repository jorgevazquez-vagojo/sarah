/**
 * Redegal V2.3 — Main JavaScript
 * A Smart Digital Company | World-Class Corporate Website
 *
 * Pure vanilla JS, zero dependencies. Performant, accessible, production-ready.
 * V2.3: Lighter design, #007fff blue primary, refined micro-interactions.
 * (c) 2026 Redegal S.A. — All rights reserved.
 */
(function () {
  'use strict';

  /* -- Design Tokens (JS-side) ------------------------------------------- */

  var COLORS = {
    primary: '#007fff',
    primaryLight: '#3399ff',
    primaryDark: '#0066cc'
  };

  /* -- Utilities --------------------------------------------------------- */

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isTouch = window.matchMedia('(pointer: coarse)').matches;

  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
  function qsa(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function throttle(fn, ms) {
    var last = 0;
    return function () {
      var now = Date.now();
      if (now - last >= ms) { last = now; fn.apply(this, arguments); }
    };
  }

  function debounce(fn, ms) {
    var timer;
    return function () {
      var ctx = this, args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOutExpo(t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function setCookie(name, value, days) {
    var d = new Date();
    d.setTime(d.getTime() + days * 86400000);
    document.cookie = name + '=' + value + ';expires=' + d.toUTCString() + ';path=/;SameSite=Lax';
  }

  function getCookie(name) {
    var v = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return v ? v.pop() : null;
  }

  /* -- 1. Preloader ------------------------------------------------------ */

  function initPreloader() {
    var preloader = qs('.preloader');
    if (!preloader) return;

    var fill = qs('.preloader-bar-fill', preloader);
    var startTime = Date.now();
    var MIN_DISPLAY = 700;

    if (fill) {
      fill.style.transition = 'width 0.5s cubic-bezier(0.4,0,0.2,1)';
      fill.style.background = 'linear-gradient(90deg, ' + COLORS.primary + ', ' + COLORS.primaryLight + ')';
      fill.style.width = '70%';
    }

    function hidePreloader() {
      var elapsed = Date.now() - startTime;
      var remaining = Math.max(0, MIN_DISPLAY - elapsed);

      setTimeout(function () {
        if (fill) fill.style.width = '100%';
        setTimeout(function () {
          preloader.style.transition = 'opacity 0.4s cubic-bezier(0.4,0,0.2,1)';
          preloader.style.opacity = '0';
          preloader.style.pointerEvents = 'none';
          setTimeout(function () {
            preloader.style.display = 'none';
            document.body.classList.add('loaded');
          }, 400);
        }, 180);
      }, remaining);
    }

    if (document.readyState === 'complete') {
      hidePreloader();
    } else {
      window.addEventListener('load', hidePreloader);
    }
  }

  /* -- 2. Custom Cursor -------------------------------------------------- */

  function initCursor() {
    if (isTouch || prefersReducedMotion) return;

    var cursor = qs('.cursor');
    if (!cursor) return;
    var dot = qs('.cursor-dot', cursor);
    var ring = qs('.cursor-ring', cursor);
    if (!dot || !ring) return;

    var mx = -100, my = -100, rx = -100, ry = -100;
    var visible = false, hovering = false, clicking = false;

    /* Apply blue color scheme to cursor elements */
    dot.style.background = COLORS.primary;
    ring.style.borderColor = COLORS.primary;

    function onMove(e) {
      mx = e.clientX;
      my = e.clientY;
      if (!visible) { cursor.style.opacity = '1'; visible = true; }
    }

    function tick() {
      dot.style.transform = 'translate(' + mx + 'px,' + my + 'px)' + (clicking ? ' scale(0.8)' : ' scale(1)');

      /* Smoother lerp factor for more refined trailing */
      rx = lerp(rx, mx, 0.12);
      ry = lerp(ry, my, 0.12);

      /* Subtler hover scale (1.4 instead of 1.6) */
      var scale = hovering ? 1.4 : 1;
      var opacity = hovering ? 0.6 : 0.4;
      ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px) scale(' + scale + ')';
      ring.style.opacity = String(opacity);
      requestAnimationFrame(tick);
    }

    document.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseleave', function () { cursor.style.opacity = '0'; visible = false; });
    document.addEventListener('mouseenter', function () { if (mx > 0) { cursor.style.opacity = '1'; visible = true; } });
    document.addEventListener('mousedown', function () { clicking = true; });
    document.addEventListener('mouseup', function () { clicking = false; });
    document.addEventListener('mouseover', function (e) {
      if (e.target.closest('a, button, .btn, .btn-magnetic, input, textarea, select, [role="button"]')) hovering = true;
    });
    document.addEventListener('mouseout', function (e) {
      if (e.target.closest('a, button, .btn, .btn-magnetic, input, textarea, select, [role="button"]')) hovering = false;
    });

    requestAnimationFrame(tick);
  }

  /* -- 3. Reading Progress ----------------------------------------------- */

  function initReadingProgress() {
    var bar = qs('.reading-progress');
    if (!bar) return;

    /* Apply blue gradient to progress bar */
    bar.style.background = 'linear-gradient(90deg, ' + COLORS.primary + ', ' + COLORS.primaryLight + ')';

    function update() {
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var progress = docHeight > 0 ? (window.pageYOffset / docHeight) * 100 : 0;
      bar.style.width = progress + '%';
    }

    window.addEventListener('scroll', throttle(update, 16), { passive: true });
    update();
  }

  /* -- 4. Smooth Scroll -------------------------------------------------- */

  function initSmoothScroll() {
    var OFFSET = 80;

    document.addEventListener('click', function (e) {
      var link = e.target.closest('a[href*="#"]');
      if (!link) return;

      var href = link.getAttribute('href');
      var hash = href.indexOf('#') !== -1 ? href.substring(href.indexOf('#')) : null;
      if (!hash || hash === '#') return;

      var url = new URL(link.href, window.location.href);
      if (url.pathname !== window.location.pathname && url.origin === window.location.origin) return;

      var target = qs(hash);
      if (!target) return;

      e.preventDefault();
      var top = target.getBoundingClientRect().top + window.pageYOffset - OFFSET;

      if (prefersReducedMotion) {
        window.scrollTo(0, top);
      } else {
        window.scrollTo({ top: top, behavior: 'smooth' });
      }
      history.pushState(null, '', hash);
    });
  }

  /* -- 5. Header Scroll -------------------------------------------------- */

  function initHeaderScroll() {
    var header = qs('.site-header');
    if (!header) return;

    var scrolled = false;

    function update() {
      var shouldBe = window.pageYOffset > 50;
      if (shouldBe !== scrolled) {
        scrolled = shouldBe;
        header.classList.toggle('header--scrolled', scrolled);
      }
    }

    window.addEventListener('scroll', throttle(update, 50), { passive: true });
    update();
  }

  /* -- 6. Mobile Menu ---------------------------------------------------- */

  function initMobileMenu() {
    var toggle = qs('.menu-toggle');
    if (!toggle) return;

    var mobileNav = qs('.mobile-nav');
    var active = false;

    function open() {
      active = true;
      document.body.classList.add('mobile-nav-active');
      toggle.setAttribute('aria-expanded', 'true');
      if (mobileNav) mobileNav.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    function close() {
      active = false;
      document.body.classList.remove('mobile-nav-active');
      toggle.setAttribute('aria-expanded', 'false');
      if (mobileNav) mobileNav.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    toggle.addEventListener('click', function () { active ? close() : open(); });

    if (mobileNav) {
      qsa('a', mobileNav).forEach(function (link) { link.addEventListener('click', close); });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && active) close();
    });
  }

  /* -- 7. Mega Menu ------------------------------------------------------ */

  function initMegaMenu() {
    qsa('.nav-dropdown').forEach(function (dropdown) {
      var mega = qs('.nav-mega', dropdown);
      if (!mega) return;

      var hideTimer;

      function show() {
        clearTimeout(hideTimer);
        mega.style.opacity = '1';
        mega.style.visibility = 'visible';
        mega.style.transform = 'translateY(0)';
      }

      function hide() {
        hideTimer = setTimeout(function () {
          mega.style.opacity = '0';
          mega.style.visibility = 'hidden';
          mega.style.transform = 'translateY(6px)';
        }, 150);
      }

      dropdown.addEventListener('mouseenter', show);
      dropdown.addEventListener('mouseleave', hide);
      dropdown.addEventListener('focusin', show);
      dropdown.addEventListener('focusout', function (e) {
        if (!dropdown.contains(e.relatedTarget)) hide();
      });
    });
  }

  /* -- 8. Search Overlay ------------------------------------------------- */

  function initSearchOverlay() {
    var overlay = qs('.search-overlay');
    if (!overlay) return;

    var input = qs('.search-overlay-input', overlay);
    var closer = qs('.search-overlay-close', overlay);

    function open() {
      overlay.classList.add('active');
      overlay.setAttribute('aria-hidden', 'false');
      if (input) setTimeout(function () { input.focus(); }, 100);
    }

    function close() {
      overlay.classList.remove('active');
      overlay.setAttribute('aria-hidden', 'true');
    }

    qsa('[data-search-open]').forEach(function (btn) { btn.addEventListener('click', open); });
    if (closer) closer.addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('active')) close();
    });
  }

  /* -- 9. Language Selector ---------------------------------------------- */

  function initLangSelector() {
    var selector = qs('.lang-selector');
    if (!selector) return;

    var menu = qs('.lang-menu', selector);
    var btn = qs('.lang-btn', selector);
    if (!menu || !btn) return;

    var open = false, hideTimer;

    function show() {
      clearTimeout(hideTimer);
      open = true;
      menu.style.opacity = '1';
      menu.style.visibility = 'visible';
      menu.style.transform = 'translateY(0)';
    }

    function hide() {
      hideTimer = setTimeout(function () {
        open = false;
        menu.style.opacity = '0';
        menu.style.visibility = 'hidden';
        menu.style.transform = 'translateY(6px)';
      }, 150);
    }

    selector.addEventListener('mouseenter', show);
    selector.addEventListener('mouseleave', hide);
    btn.addEventListener('click', function () { open ? hide() : show(); });
    document.addEventListener('click', function (e) {
      if (open && !selector.contains(e.target)) hide();
    });
  }

  /* -- 10. Dark Mode Toggle ---------------------------------------------- */

  function initDarkMode() {
    var toggle = qs('.theme-toggle');
    var html = document.documentElement;

    var stored = localStorage.getItem('redegal-theme');
    if (stored) {
      html.setAttribute('data-theme', stored);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      html.setAttribute('data-theme', 'dark');
    }

    /* Listen for OS-level theme changes */
    try {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
        if (!localStorage.getItem('redegal-theme')) {
          html.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        }
      });
    } catch (err) { /* older browsers */ }

    if (!toggle) return;

    toggle.addEventListener('click', function () {
      /* Add transition class for smooth theme switch */
      html.classList.add('theme-transitioning');
      var next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      localStorage.setItem('redegal-theme', next);

      /* Remove transition class after animation completes */
      setTimeout(function () {
        html.classList.remove('theme-transitioning');
      }, 400);
    });
  }

  /* -- 11. Scroll Reveal ------------------------------------------------- */

  function initScrollReveal() {
    if (prefersReducedMotion) {
      qsa('.reveal').forEach(function (el) { el.classList.add('visible'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;

        var el = entry.target;
        var stagger = el.getAttribute('data-stagger');
        if (stagger) {
          Array.prototype.slice.call(el.children).forEach(function (child, i) {
            child.style.transitionDelay = (i * parseFloat(stagger)) + 's';
          });
        }

        el.classList.add('visible');
        observer.unobserve(el);
      });
    }, {
      /* Very low threshold so elements reveal as soon as they enter viewport */
      threshold: 0.05,
      /* Positive bottom margin triggers reveal before element is fully in view */
      rootMargin: '0px 0px 50px 0px'
    });

    qsa('.reveal').forEach(function (el) { observer.observe(el); });
  }

  /* -- 12. Counter Animation --------------------------------------------- */

  function initCounters() {
    var els = qsa('[data-counter]');
    if (!els.length) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;

        var el = entry.target;
        observer.unobserve(el);

        var target = parseFloat(el.getAttribute('data-counter'));
        var prefix = el.getAttribute('data-prefix') || '';
        var suffix = el.getAttribute('data-suffix') || '';
        var decimals = (String(target).split('.')[1] || '').length;
        var duration = 2000;
        var start = performance.now();

        if (prefersReducedMotion) {
          el.textContent = prefix + target + suffix;
          return;
        }

        function tick(now) {
          var progress = Math.min((now - start) / duration, 1);
          var current = easeOutExpo(progress) * target;
          el.textContent = prefix + (decimals > 0 ? current.toFixed(decimals) : Math.round(current)) + suffix;
          if (progress < 1) requestAnimationFrame(tick);
        }

        requestAnimationFrame(tick);
      });
    }, { threshold: 0.3 });

    els.forEach(function (el) { observer.observe(el); });
  }

  /* -- 13. Typing Effect ------------------------------------------------- */

  function initTypingEffect() {
    var els = qsa('[data-typing]');
    if (!els.length || prefersReducedMotion) return;

    els.forEach(function (el) {
      var strings;
      try { strings = JSON.parse(el.getAttribute('data-typing')); } catch (e) { return; }
      if (!Array.isArray(strings) || !strings.length) return;

      var index = 0, charIndex = 0, deleting = false;
      var current = strings[0] || '';
      el.textContent = current;

      /* Apply blue caret color for typing cursor */
      el.style.borderRightColor = COLORS.primary;

      function tick() {
        current = strings[index];

        if (!deleting) {
          charIndex++;
          el.textContent = current.substring(0, charIndex);
          if (charIndex === current.length) {
            setTimeout(function () { deleting = true; tick(); }, 2000);
            return;
          }
          setTimeout(tick, 80 + Math.random() * 40);
        } else {
          charIndex--;
          el.textContent = current.substring(0, charIndex);
          if (charIndex === 0) {
            deleting = false;
            index = (index + 1) % strings.length;
            setTimeout(tick, 500);
            return;
          }
          setTimeout(tick, 40);
        }
      }

      setTimeout(function () {
        charIndex = current.length;
        deleting = true;
        tick();
      }, 3000);
    });
  }

  /* -- 14. Magnetic Buttons ---------------------------------------------- */

  function initMagneticButtons() {
    if (isTouch || prefersReducedMotion) return;

    /* Slightly reduced offset for subtler magnetic pull */
    var MAX_OFFSET = 6;

    qsa('.btn-magnetic').forEach(function (btn) {
      btn.addEventListener('mousemove', function (e) {
        var rect = btn.getBoundingClientRect();
        var cx = rect.left + rect.width / 2;
        var cy = rect.top + rect.height / 2;
        var tx = ((e.clientX - cx) / (rect.width / 2)) * MAX_OFFSET;
        var ty = ((e.clientY - cy) / (rect.height / 2)) * MAX_OFFSET;
        btn.style.transform = 'translate(' + tx + 'px,' + ty + 'px)';
      });

      btn.addEventListener('mouseleave', function () {
        btn.style.transform = '';
        btn.style.transition = 'transform 0.35s cubic-bezier(0.25,0.46,0.45,0.94)';
        setTimeout(function () { btn.style.transition = ''; }, 350);
      });
    });
  }

  /* -- 15. Parallax (Hero Glow) ------------------------------------------ */

  function initParallax() {
    if (isTouch || prefersReducedMotion) return;

    var glows = qsa('.hero-glow');
    if (!glows.length) return;

    /* Reduced parallax range for subtler, more premium feel */
    var MAX = 24;
    var targetX = 0, targetY = 0, currentX = 0, currentY = 0;
    var running = false;

    function onMove(e) {
      targetX = ((e.clientX / window.innerWidth) - 0.5) * 2 * MAX;
      targetY = ((e.clientY / window.innerHeight) - 0.5) * 2 * MAX;
      if (!running) { running = true; requestAnimationFrame(tick); }
    }

    function tick() {
      currentX = lerp(currentX, targetX, 0.06);
      currentY = lerp(currentY, targetY, 0.06);

      glows.forEach(function (glow, i) {
        var f = i === 0 ? 1 : -0.5;
        glow.style.transform = 'translate(' + (currentX * f) + 'px,' + (currentY * f) + 'px)';
      });

      if (Math.abs(currentX - targetX) > 0.1 || Math.abs(currentY - targetY) > 0.1) {
        requestAnimationFrame(tick);
      } else {
        running = false;
      }
    }

    document.addEventListener('mousemove', onMove, { passive: true });
  }

  /* -- 16. Logo Marquee -------------------------------------------------- */

  function initLogoMarquee() {
    var track = qs('.logos-track');
    if (!track) return;

    var marquee = track.closest('.logos-marquee');
    if (!marquee) return;

    marquee.addEventListener('mouseenter', function () { track.style.animationPlayState = 'paused'; });
    marquee.addEventListener('mouseleave', function () { track.style.animationPlayState = 'running'; });
  }

  /* -- 17. Testimonial Carousel ------------------------------------------ */

  function initTestimonialCarousel() {
    var track = qs('.testimonials-track');
    if (!track) return;

    var cards = qsa('.testimonial-card', track);
    var dots = qsa('.testimonial-dot');
    if (cards.length < 2) return;

    var current = 0, total = cards.length, autoTimer;
    var AUTO_INTERVAL = 6000;

    function goTo(index) {
      current = ((index % total) + total) % total;
      track.style.transform = 'translateX(-' + (current * 100) + '%)';
      track.style.transition = prefersReducedMotion ? 'none' : 'transform 0.5s cubic-bezier(0.4,0,0.2,1)';
      dots.forEach(function (dot, i) { dot.classList.toggle('active', i === current); });
    }

    function startAuto() { stopAuto(); autoTimer = setInterval(function () { goTo(current + 1); }, AUTO_INTERVAL); }
    function stopAuto() { clearInterval(autoTimer); }

    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () { goTo(i); startAuto(); });
    });

    var slider = track.closest('.testimonials-slider');
    if (slider) {
      slider.addEventListener('mouseenter', stopAuto);
      slider.addEventListener('mouseleave', startAuto);
    }

    goTo(0);
    startAuto();
  }

  /* -- 18. Chatbot ------------------------------------------------------- */

  function initChatbot() {
    var widget = qs('.chatbot-widget');
    if (!widget) return;

    var trigger = qs('.chatbot-trigger', widget);
    var win = qs('.chatbot-window', widget);
    var closeBtn = qs('.chatbot-close', widget);
    var inputArea = qs('.chatbot-input', widget);
    var messages = qs('.chatbot-messages', widget);
    var badge = qs('.chatbot-badge', widget);

    if (!trigger || !win || !inputArea || !messages) return;

    var input = qs('input', inputArea);
    var sendBtn = qs('button', inputArea);
    var isOpen = false;

    function getBotResponse(text) {
      var t = text.toLowerCase();
      if (/hola|hello|hi|hey|buenos/.test(t))
        return 'Hello! Welcome to Redegal. How can I help you today? I can tell you about our services, case studies, or connect you with our team.';
      if (/boostic|seo|search|organic/.test(t))
        return 'Boostic is our proprietary SEO & AI platform. We help brands achieve +339% organic traffic growth on average. Want to learn more or schedule a demo?';
      if (/binnacle|analytics|data|dashboard/.test(t))
        return 'Binnacle is our advanced analytics and business intelligence platform. It unifies all your data sources into actionable dashboards. Shall I connect you with a specialist?';
      if (/tech|shopify|adobe|magento|commerce|ecommerce/.test(t))
        return 'Our Digital Tech team are certified Shopify Plus and Adobe Commerce experts. We build scalable, conversion-optimized stores for global brands like Cupra and Primor.';
      if (/case|client|portfolio|work|proyecto/.test(t))
        return 'We have worked with 200+ leading brands including Cupra, ABANCA, Adolfo Dominguez, and Primor. Check our case studies at /cases for detailed results.';
      if (/contact|talk|meeting|call|hablar/.test(t))
        return 'We would love to connect! You can reach us at info@redegal.com or +34 988 549 858, or fill out the form at /contact. We typically respond within 24 hours.';
      if (/price|cost|budget|presupuesto|precio/.test(t))
        return 'Our solutions are tailored to each client. We work with budgets from mid-market to enterprise. Let us discuss your specific needs. Shall I arrange a consultation?';
      if (/invest|stock|bme|rdg|accion/.test(t))
        return 'Redegal trades on BME Growth as RDG. Our 2024 revenue was 16.6M EUR with strong year-over-year growth. Visit /investors for full financial information.';
      if (/career|job|trabajo|empleo|hiring/.test(t))
        return 'We are always looking for talented people! Check our open positions at /careers. We have offices in Ourense, A Coruna, Madrid, Barcelona, and Mexico City.';
      if (/marketing|digital business|campaign|campana/.test(t))
        return 'Our Digital Business division handles paid media, social, CRO, and marketplace management. We are Google Premier Partners and Meta Business Partners.';
      if (/gracias|thanks|thank/.test(t))
        return 'You are welcome! If you need anything else, feel free to ask. Have a great day!';
      return 'Thank you for your interest in Redegal! For specific inquiries, you can contact us at info@redegal.com or call +34 988 549 858. How else can I help?';
    }

    function addMessage(text, type) {
      var msg = document.createElement('div');
      msg.className = 'chat-message chat-message--' + type;
      msg.textContent = text;
      messages.appendChild(msg);
      messages.scrollTop = messages.scrollHeight;
    }

    function send() {
      var text = (input.value || '').trim();
      if (!text) return;
      addMessage(text, 'user');
      input.value = '';
      setTimeout(function () { addMessage(getBotResponse(text), 'bot'); }, 600 + Math.random() * 400);
    }

    function toggleOpen() {
      isOpen = !isOpen;
      win.style.display = isOpen ? 'flex' : 'none';
      if (badge) badge.style.display = 'none';
      if (isOpen && input) setTimeout(function () { input.focus(); }, 100);
    }

    trigger.addEventListener('click', toggleOpen);
    if (closeBtn) closeBtn.addEventListener('click', function () { isOpen = false; win.style.display = 'none'; });
    if (sendBtn) sendBtn.addEventListener('click', send);
    if (input) input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); send(); } });
  }

  /* -- 19. WebPhone ------------------------------------------------------ */

  function initWebphone() {
    var trigger = qs('.webphone-trigger');
    if (!trigger) return;
    trigger.addEventListener('click', function () { window.location.href = 'tel:+34988549858'; });
  }

  /* -- 20. Cookie Consent ------------------------------------------------ */

  function initCookieConsent() {
    var banner = qs('.cookie-consent');
    if (!banner) return;

    if (getCookie('redegal_cookies')) {
      banner.style.display = 'none';
      return;
    }

    banner.style.display = '';
    banner.setAttribute('aria-hidden', 'false');

    function dismiss(value) {
      setCookie('redegal_cookies', value, 365);
      banner.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      banner.style.opacity = '0';
      banner.style.transform = 'translateY(16px)';
      setTimeout(function () {
        banner.style.display = 'none';
        banner.setAttribute('aria-hidden', 'true');
      }, 300);
    }

    banner.addEventListener('click', function (e) {
      var action = e.target.closest('[data-cookie-action]');
      if (action) dismiss(action.getAttribute('data-cookie-action'));
    });
  }

  /* -- 21. Contact Form (AJAX) ------------------------------------------- */

  function initContactForm() {
    var form = qs('form.contact-form');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var submitBtn = qs('[type="submit"]', form);
      if (submitBtn && submitBtn.disabled) return;

      var formData = new FormData(form);
      formData.append('action', 'redegal_contact');
      formData.append('nonce', (window.redegalData && window.redegalData.nonce) || '');

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.setAttribute('data-original-text', submitBtn.textContent);
        submitBtn.textContent = 'Sending...';
      }

      var prev = qs('.form-message', form);
      if (prev) prev.remove();

      var ajaxUrl = (window.redegalData && window.redegalData.ajaxUrl) || '/wp-admin/admin-ajax.php';

      fetch(ajaxUrl, { method: 'POST', body: formData })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          var msgEl = document.createElement('div');
          msgEl.className = 'form-message form-message--' + (data.success ? 'success' : 'error');
          msgEl.textContent = (data.data && data.data.message) || (data.success ? 'Message sent!' : 'Something went wrong.');
          form.appendChild(msgEl);
          if (data.success) form.reset();
        })
        .catch(function () {
          var msgEl = document.createElement('div');
          msgEl.className = 'form-message form-message--error';
          msgEl.textContent = 'Network error. Please try again.';
          form.appendChild(msgEl);
        })
        .finally(function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = submitBtn.getAttribute('data-original-text') || 'Send';
          }
        });
    });
  }

  /* -- 22. Page Transitions ---------------------------------------------- */

  function initPageTransitions() {
    if (prefersReducedMotion) return;

    document.addEventListener('click', function (e) {
      var link = e.target.closest('a');
      if (!link) return;

      var href = link.getAttribute('href');
      if (!href || href.charAt(0) === '#' || link.target === '_blank' || link.hasAttribute('download')) return;

      try {
        var url = new URL(link.href, window.location.href);
        if (url.origin !== window.location.origin) return;
      } catch (err) { return; }

      e.preventDefault();
      var main = qs('#main');
      if (main) {
        main.style.transition = 'opacity 0.2s ease';
        main.style.opacity = '0.6';
      }

      setTimeout(function () { window.location.href = link.href; }, 200);
    });
  }

  /* -- 23. Hero Scroll Fade ---------------------------------------------- */

  function initHeroScrollFade() {
    if (prefersReducedMotion) return;

    var hero = qs('.hero-content');
    if (!hero) return;

    function update() {
      var scrollY = window.pageYOffset;
      var fadeEnd = window.innerHeight * 0.6;
      if (scrollY > fadeEnd) {
        hero.style.opacity = '0';
        hero.style.transform = 'translateY(-16px)';
      } else if (scrollY > 0) {
        var ratio = 1 - (scrollY / fadeEnd);
        hero.style.opacity = String(ratio);
        hero.style.transform = 'translateY(' + (-scrollY * 0.06) + 'px)';
      } else {
        hero.style.opacity = '1';
        hero.style.transform = 'translateY(0)';
      }
    }

    window.addEventListener('scroll', throttle(update, 16), { passive: true });
    update();
  }

  /* -- 24. IR Tabs (Investors Page) -------------------------------------- */

  function initIRTabs() {
    var tabsContainers = qsa('.ir-tabs');
    tabsContainers.forEach(function (container) {
      var tabs = qsa('.ir-tab', container);
      var panels = qsa('.ir-tab-panel', container);
      if (!tabs.length || !panels.length) return;

      tabs.forEach(function (tab, idx) {
        tab.addEventListener('click', function () {
          tabs.forEach(function (t) {
            t.classList.remove('active');
            t.setAttribute('aria-selected', 'false');
          });
          panels.forEach(function (p) {
            p.classList.remove('active');
            p.hidden = true;
          });
          tab.classList.add('active');
          tab.setAttribute('aria-selected', 'true');
          if (panels[idx]) {
            panels[idx].classList.add('active');
            panels[idx].hidden = false;
          }
        });
      });
    });
  }

  /* -- 24b. Mobile Nav Accordion ------------------------------------------- */

  function initMobileAccordion() {
    var triggers = qsa('.mobile-nav-link--parent');
    triggers.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var submenu = btn.nextElementSibling;
        if (!submenu) return;
        var expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!expanded));
        submenu.setAttribute('aria-hidden', String(!expanded));
      });
    });
  }

  /* -- 25. Category Filters (Cases & Blog) -------------------------------- */

  function initCategoryFilters() {
    /* Cases page filters */
    var casesFilters = qsa('.cases-filter');
    if (casesFilters.length) {
      var caseCards = qsa('.cases-page-grid .case-card');
      casesFilters.forEach(function (btn) {
        btn.addEventListener('click', function () {
          casesFilters.forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          var cat = btn.getAttribute('data-filter');
          caseCards.forEach(function (card) {
            if (cat === 'all' || card.getAttribute('data-category') === cat) {
              card.style.display = '';
              card.style.animation = 'fadeInUp 0.35s cubic-bezier(0.4,0,0.2,1) both';
            } else {
              card.style.display = 'none';
            }
          });
        });
      });
    }

    /* Blog category filters */
    var blogCats = qsa('.blog-cat');
    if (blogCats.length) {
      var blogCards = qsa('.blog-card');
      blogCats.forEach(function (btn) {
        btn.addEventListener('click', function () {
          blogCats.forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          var cat = btn.getAttribute('data-category');
          blogCards.forEach(function (card) {
            if (cat === 'all' || card.getAttribute('data-category') === cat) {
              card.style.display = '';
              card.style.animation = 'fadeInUp 0.35s cubic-bezier(0.4,0,0.2,1) both';
            } else {
              card.style.display = 'none';
            }
          });
        });
      });
    }
  }

  /* -- Init -------------------------------------------------------------- */

  function init() {
    initPreloader();
    /* Ensure 'loaded' class is always added as a safety net for reveal animations */
    setTimeout(function () {
      if (!document.body.classList.contains('loaded')) {
        document.body.classList.add('loaded');
      }
    }, 2500);
    initCursor();
    initReadingProgress();
    initSmoothScroll();
    initHeaderScroll();
    initMobileMenu();
    initMegaMenu();
    initSearchOverlay();
    initLangSelector();
    initDarkMode();
    initScrollReveal();
    initCounters();
    initTypingEffect();
    initMagneticButtons();
    initParallax();
    initLogoMarquee();
    initTestimonialCarousel();
    initChatbot();
    initWebphone();
    initCookieConsent();
    initContactForm();
    initPageTransitions();
    initHeroScrollFade();
    initIRTabs();
    initMobileAccordion();
    initCategoryFilters();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
