/* ============================================================
   TITANIUM ATELIER — script.js
   Vanilla JS: Intersection Observer, requestAnimationFrame,
   DOM API, CSS Custom Properties. Без внешних библиотек.
   ============================================================ */

(() => {
  'use strict';

  /* ---------- 0. КОНФИГ И СРЕДА ---------- */

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = prefersReducedMotion.matches;

  // Грубая эвристика "слабого" устройства: мало ядер CPU или явный признак экономии данных.
  // Используется только чтобы отключить самые тяжёлые эффекты (3D-наклон, сложный параллакс).
  const isLowPowerDevice = () => {
    const cores = navigator.hardwareConcurrency || 8;
    const saveData = navigator.connection && navigator.connection.saveData;
    return cores <= 4 || !!saveData;
  };

  const html = document.documentElement;
  if (reducedMotion || isLowPowerDevice()) {
    html.classList.add('reduce-fx');
  }

  prefersReducedMotion.addEventListener('change', (e) => {
    reducedMotion = e.matches;
    html.classList.toggle('reduce-fx', reducedMotion || isLowPowerDevice());
  });

  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

  /* ---------- 1. HERO: ПОЯВЛЕНИЕ ПРИ ЗАГРУЗКЕ ---------- */

  const hero = document.querySelector('.hero');

  function revealHero() {
    if (!hero) return;
    // requestAnimationFrame гарантирует, что стили применились до старта анимации
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        hero.classList.add('is-loaded');
      });
    });
  }

  function initHeroReveal() {
    // Если прелоадер активен, hero открывается только после его завершения (см. initPreloader).
    if (!hero || document.body.classList.contains('is-preloading')) return;
    revealHero();
  }

  /* ---------- 1b. ПРЕЛОАДЕР ---------- */

  function initPreloader() {
    const preloader = document.getElementById('preloader');
    if (!preloader) {
      revealHero();
      return;
    }

    const fill = document.getElementById('preloaderFill');
    const count = document.getElementById('preloaderCount');
    const srStatus = document.getElementById('preloaderSrStatus');
    const blades = preloader.querySelectorAll('.preloader-blade');

    // Reduced motion / слабое устройство: показать прелоадер без анимации минимально долго и снять.
    if (reducedMotion || isLowPowerDevice()) {
      blades.forEach((blade) => { blade.style.setProperty('--blade-open', '1'); });
      const finish = () => {
        document.body.classList.remove('is-preloading');
        preloader.setAttribute('hidden', '');
        revealHero();
      };
      if (document.readyState === 'complete') {
        finish();
      } else {
        window.addEventListener('load', finish, { once: true });
      }
      return;
    }

    let progress = 0;
    let pageLoaded = false;
    let rafId = null;
    let lastFrameAt = performance.now();
    const startedAt = performance.now();
    // Премиальный прелоадер должен ощущаться как осознанный ритуал, а не мигание —
    // даже на мгновенной загрузке показываем его не короче этого времени.
    const MIN_VISIBLE_MS = 2200;

    function setProgress(value) {
      progress = Math.min(value, 100);
      const rounded = Math.round(progress);
      // Полоса и число процента обновляются в одном кадре из одного и того же значения progress,
      // поэтому не могут разойтись между собой.
      if (fill) fill.style.width = progress + '%';
      if (count) count.textContent = String(rounded).padStart(2, '0');
      // Лепестки раскрываются строго по очереди, один за другим: весь диапазон 0–100%
      // прогресса поделён на последовательные окна по числу лепестков, с небольшим
      // нахлёстом между соседними окнами, чтобы стык не выглядел рывком.
      const t = progress / 100;
      const count_ = blades.length;
      const overlap = 0.35; // доля окна, на которую соседние лепестки перекрываются
      const windowSpan = 1 / (count_ - (count_ - 1) * overlap);
      const step = windowSpan * (1 - overlap);
      blades.forEach((blade, i) => {
        const start = i * step;
        const local = Math.min(Math.max((t - start) / windowSpan, 0), 1);
        const eased = 1 - Math.pow(1 - local, 3); // ease-out cubic, ощущается как var(--ease-atelier)
        const bladeOpen = 0.06 + eased * 0.94;
        blade.style.setProperty('--blade-open', bladeOpen.toFixed(3));
      });
    }

    // Прогресс "тянется" к асимптоте 90%, реальная загрузка страницы (window.load)
    // и истечение минимального времени показа отпускают его до 100%.
    // Скорость привязана к реальному времени (мс с прошлого кадра), а не к количеству кадров,
    // поэтому итоговая длительность не скачет между быстрыми и медленными устройствами.
    function tick(now) {
      const dt = Math.min(now - lastFrameAt, 48);
      lastFrameAt = now;
      const elapsed = now - startedAt;
      const readyToFinish = pageLoaded && elapsed >= MIN_VISIBLE_MS;
      const ceiling = readyToFinish ? 100 : 90;
      const remaining = ceiling - progress;
      // Скорость в "процентах в секунду": размеренный набор до 90%, чуть более быстрый финальный рывок.
      const rate = readyToFinish ? Math.max(remaining * 3.2, 55) : 42;
      const step = (rate * dt) / 1000;
      setProgress(progress + Math.min(step, remaining));

      if (progress < 100) {
        rafId = requestAnimationFrame(tick);
      } else {
        finishPreloader();
      }
    }

    function finishPreloader() {
      if (rafId) cancelAnimationFrame(rafId);
      if (srStatus) srStatus.textContent = 'Страница загружена';
      preloader.classList.add('is-leaving');
      document.body.classList.remove('is-preloading');
      revealHero();

      window.setTimeout(() => {
        preloader.setAttribute('hidden', '');
      }, 1800);
    }

    window.addEventListener('load', () => {
      pageLoaded = true;
    }, { once: true });

    // Прелоадер держится, пока страница не загрузится полностью (событие window.load —
    // весь HTML, CSS, шрифты и изображения). Никакого принудительного тайм-аута здесь
    // намеренно нет: снимать прелоадер раньше фактической готовности страницы означало бы
    // показывать недогруженный контент — то, чего прелоадер как раз должен избегать.
    if (document.readyState === 'complete') {
      pageLoaded = true;
    }

    rafId = requestAnimationFrame(tick);
  }

  /* ---------- 2. SCROLL-REVEAL ЧЕРЕЗ INTERSECTION OBSERVER ---------- */

  function initScrollReveal() {
    const targets = document.querySelectorAll('.reveal-on-scroll, .philosophy-title');
    if (!targets.length) return;

    if (reducedMotion) {
      targets.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -8% 0px',
      }
    );

    targets.forEach((el) => observer.observe(el));
  }

  /* ---------- 3. HEADER: СОСТОЯНИЕ ПРИ СКРОЛЛЕ + АКТИВНАЯ СЕКЦИЯ ---------- */

  const siteHeader = document.getElementById('siteHeader');
  const navLinks = Array.from(document.querySelectorAll('.nav-link'));
  const sectionsForNav = navLinks
    .map((link) => {
      const id = link.getAttribute('href');
      const section = id && id.startsWith('#') ? document.querySelector(id) : null;
      return section ? { link, section } : null;
    })
    .filter(Boolean);

  let lastScrollY = window.scrollY;
  let headerTicking = false;

  function updateHeaderState() {
    const scrolled = window.scrollY > 12;
    siteHeader.classList.toggle('is-scrolled', scrolled);

    // Активная ссылка навигации по текущей секции в зоне видимости
    if (sectionsForNav.length) {
      const offset = window.innerHeight * 0.35;
      let current = null;

      for (const item of sectionsForNav) {
        const rect = item.section.getBoundingClientRect();
        if (rect.top <= offset && rect.bottom >= offset) {
          current = item;
        }
      }

      sectionsForNav.forEach(({ link }) => link.classList.remove('is-active'));
      if (current) current.link.classList.add('is-active');
    }

    lastScrollY = window.scrollY;
    headerTicking = false;
  }

  function onScrollHeader() {
    if (!headerTicking) {
      requestAnimationFrame(updateHeaderState);
      headerTicking = true;
    }
  }

  /* ---------- 4. МОБИЛЬНОЕ МЕНЮ ---------- */

  const menuToggle = document.getElementById('menuToggle');
  const mobileMenu = document.getElementById('mobileMenu');
  const mobileNavLinks = mobileMenu ? Array.from(mobileMenu.querySelectorAll('a')) : [];

  function openMobileMenu() {
    mobileMenu.classList.add('is-open');
    mobileMenu.setAttribute('aria-hidden', 'false');
    menuToggle.setAttribute('aria-expanded', 'true');
    menuToggle.setAttribute('aria-label', 'Закрыть меню');
    document.body.style.overflow = 'hidden';
    const firstLink = mobileMenu.querySelector('a');
    if (firstLink) firstLink.focus({ preventScroll: true });
  }

  function closeMobileMenu() {
    mobileMenu.classList.remove('is-open');
    mobileMenu.setAttribute('aria-hidden', 'true');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Открыть меню');
    document.body.style.overflow = '';
  }

  function initMobileMenu() {
    if (!menuToggle || !mobileMenu) return;

    menuToggle.addEventListener('click', () => {
      const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
      isOpen ? closeMobileMenu() : openMobileMenu();
    });

    mobileNavLinks.forEach((link) => {
      link.addEventListener('click', () => closeMobileMenu());
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
        closeMobileMenu();
        menuToggle.focus();
      }
    });
  }

  /* ---------- 5. ПЛАВНЫЙ СКРОЛЛ К ЯКОРЯМ ---------- */

  function initSmoothScroll() {
    const anchorLinks = document.querySelectorAll('a[href^="#"]');

    anchorLinks.forEach((link) => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (!href || href === '#') return;

        const target = document.querySelector(href);
        if (!target) return;

        e.preventDefault();

        const headerH = parseInt(
          getComputedStyle(document.documentElement).getPropertyValue('--header-h'),
          10
        ) || 84;

        const top = target.getBoundingClientRect().top + window.scrollY - headerH + 1;

        window.scrollTo({
          top,
          behavior: reducedMotion ? 'auto' : 'smooth',
        });

        // Обновляем фокус для доступности после скролла
        target.setAttribute('tabindex', '-1');
        target.addEventListener(
          'blur',
          () => target.removeAttribute('tabindex'),
          { once: true }
        );
        window.setTimeout(() => target.focus({ preventScroll: true }), reducedMotion ? 0 : 500);
      });
    });
  }

  /* ---------- 6. MAGNETIC BUTTONS ---------- */

  function initMagneticButtons() {
    if (isCoarsePointer || reducedMotion) return;

    const buttons = document.querySelectorAll('.magnetic-btn');
    const MAX_OFFSET = 6; // px, согласно спецификации брифа (4–6px)

    buttons.forEach((btn) => {
      let rafId = null;
      let targetX = 0;
      let targetY = 0;
      let currentX = 0;
      let currentY = 0;

      function animate() {
        currentX += (targetX - currentX) * 0.22;
        currentY += (targetY - currentY) * 0.22;
        btn.style.transform = `translate(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px)`;

        if (Math.abs(targetX - currentX) > 0.05 || Math.abs(targetY - currentY) > 0.05) {
          rafId = requestAnimationFrame(animate);
        } else {
          rafId = null;
        }
      }

      function onMove(e) {
        const rect = btn.getBoundingClientRect();
        const relX = e.clientX - rect.left - rect.width / 2;
        const relY = e.clientY - rect.top - rect.height / 2;
        targetX = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, relX * 0.25));
        targetY = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, relY * 0.25));
        if (!rafId) rafId = requestAnimationFrame(animate);
      }

      function onLeave() {
        targetX = 0;
        targetY = 0;
        if (!rafId) rafId = requestAnimationFrame(animate);
      }

      btn.addEventListener('mousemove', onMove);
      btn.addEventListener('mouseleave', onLeave);
    });
  }

  /* ---------- 7. 3D TILT ДЛЯ УСТРОЙСТВ (СВЕТОВОЙ БЛИК + НАКЛОН) ---------- */

  function initDeviceTilt() {
    if (isCoarsePointer || reducedMotion || html.classList.contains('reduce-fx')) return;

    const tiltEls = document.querySelectorAll('[data-tilt]');
    const MAX_TILT = 3; // градуса, согласно брифу (2–3°)

    tiltEls.forEach((el) => {
      const wrapper = el.closest('.exhibit-visual, .macro-frame') || el;
      let rafId = null;
      let targetRX = 0;
      let targetRY = 0;
      let currentRX = 0;
      let currentRY = 0;

      function apply() {
        currentRX += (targetRX - currentRX) * 0.15;
        currentRY += (targetRY - currentRY) * 0.15;
        el.style.transform = `rotateX(${currentRX.toFixed(2)}deg) rotateY(${currentRY.toFixed(2)}deg)`;

        if (Math.abs(targetRX - currentRX) > 0.01 || Math.abs(targetRY - currentRY) > 0.01) {
          rafId = requestAnimationFrame(apply);
        } else {
          rafId = null;
        }
      }

      function onMove(e) {
        const rect = wrapper.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        targetRX = -py * MAX_TILT * 2;
        targetRY = px * MAX_TILT * 2;
        if (!rafId) rafId = requestAnimationFrame(apply);
      }

      function onLeave() {
        targetRX = 0;
        targetRY = 0;
        if (!rafId) rafId = requestAnimationFrame(apply);
      }

      wrapper.addEventListener('mousemove', onMove);
      wrapper.addEventListener('mouseleave', onLeave);
    });
  }

  /* ---------- 8. SPOTLIGHT CURSOR НА ФОТО-ФРЕЙМАХ ---------- */

  function initSpotlightCursor() {
    if (isCoarsePointer || reducedMotion) return;

    const frames = document.querySelectorAll('.macro-frame, .detail-card');

    frames.forEach((frame) => {
      const layer = document.createElement('div');
      layer.className = 'spotlight-layer';
      layer.setAttribute('aria-hidden', 'true');
      frame.appendChild(layer);
      frame.classList.add('has-spotlight');

      let rafId = null;
      let pendingX = 50;
      let pendingY = 50;

      function apply() {
        frame.style.setProperty('--spot-x', pendingX + '%');
        frame.style.setProperty('--spot-y', pendingY + '%');
        rafId = null;
      }

      frame.addEventListener('mousemove', (e) => {
        const rect = frame.getBoundingClientRect();
        pendingX = ((e.clientX - rect.left) / rect.width) * 100;
        pendingY = ((e.clientY - rect.top) / rect.height) * 100;
        if (!rafId) rafId = requestAnimationFrame(apply);
      });
    });
  }

  /* ---------- 9. DEPTH PARALLAX (ЛЁГКИЙ, СКРОЛЛ-ЗАВИСИМЫЙ) ---------- */

  function initDepthParallax() {
    if (reducedMotion || html.classList.contains('reduce-fx')) return;

    const parallaxEls = Array.from(document.querySelectorAll('.parallax-el'));
    if (!parallaxEls.length) return;

    let ticking = false;

    function update() {
      const viewportH = window.innerHeight;

      parallaxEls.forEach((el) => {
        const rect = el.getBoundingClientRect();
        // Только если элемент в пределах видимости ± немного за краями
        if (rect.bottom < -100 || rect.top > viewportH + 100) return;

        const speed = parseFloat(el.dataset.parallax) || 0.05;
        const centerOffset = rect.top + rect.height / 2 - viewportH / 2;
        const translate = (-centerOffset * speed).toFixed(2);
        el.style.transform = `translateY(${translate}px)`;
      });

      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    update();
  }

  /* ---------- 10. ГОРИЗОНТАЛЬНАЯ ЛЕНТА "ДЕТАЛИ" (drag + wheel) ---------- */

  function initDetailsTrack() {
    const wrap = document.querySelector('.details-track-wrap');
    const track = document.getElementById('detailsTrack');
    if (!wrap || !track) return;

    // Проброс вертикального колеса мыши в горизонтальный скролл при наведении
    wrap.addEventListener(
      'wheel',
      (e) => {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          wrap.scrollLeft += e.deltaY;
          e.preventDefault();
        }
      },
      { passive: false }
    );

    // Drag для мыши (тач-устройства используют нативный overflow-scroll)
    if (!isCoarsePointer) {
      let isDown = false;
      let startX = 0;
      let scrollStart = 0;

      wrap.addEventListener('mousedown', (e) => {
        isDown = true;
        wrap.classList.add('is-dragging');
        startX = e.pageX;
        scrollStart = wrap.scrollLeft;
      });

      window.addEventListener('mouseup', () => {
        isDown = false;
        wrap.classList.remove('is-dragging');
      });

      window.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const delta = e.pageX - startX;
        wrap.scrollLeft = scrollStart - delta;
      });
    }

    wrap.style.overflowX = 'auto';
    wrap.style.scrollBehavior = reducedMotion ? 'auto' : 'smooth';
    wrap.style.cursor = isCoarsePointer ? 'default' : 'grab';
  }

  /* ---------- 11. МИНИМАЛЬНАЯ FAQ-АККОРДЕОН ЛОГИКА (готова к использованию) ---------- */
  // На текущей странице визуального FAQ-блока нет (вопросы вынесены в Schema.org),
  // но функция подготовлена для .faq-item / .faq-trigger, если блок будет добавлен.

  function initFaqAccordion() {
    const items = document.querySelectorAll('.faq-item');
    if (!items.length) return;

    items.forEach((item) => {
      const trigger = item.querySelector('.faq-trigger');
      const panel = item.querySelector('.faq-panel');
      if (!trigger || !panel) return;

      trigger.setAttribute('aria-expanded', 'false');

      trigger.addEventListener('click', () => {
        const isOpen = trigger.getAttribute('aria-expanded') === 'true';

        items.forEach((other) => {
          const otherTrigger = other.querySelector('.faq-trigger');
          const otherPanel = other.querySelector('.faq-panel');
          if (otherTrigger && otherPanel) {
            otherTrigger.setAttribute('aria-expanded', 'false');
            otherPanel.style.maxHeight = null;
          }
        });

        if (!isOpen) {
          trigger.setAttribute('aria-expanded', 'true');
          panel.style.maxHeight = panel.scrollHeight + 'px';
        }
      });
    });
  }

  /* ---------- 11b. ФОРМА ЗАПИСИ (футер) ---------- */

  function initBookingForm() {
    const form = document.getElementById('bookingForm');
    if (!form) return;

    const statusEl = document.getElementById('bookingStatus');
    const submitBtn = form.querySelector('.footer-form-submit');
    const submitLabel = form.querySelector('.footer-form-submit-label');
    const fields = form.querySelectorAll('input[required], textarea[required]');

    // Помечаем поле как "тронутое" после первого blur, чтобы не подсвечивать
    // ошибку до того, как пользователь начал с ним взаимодействовать
    fields.forEach((field) => {
      field.addEventListener('blur', () => field.classList.add('touched'));
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const isValid = form.checkValidity();
      if (!isValid) {
        fields.forEach((field) => field.classList.add('touched'));
        statusEl.textContent = 'Пожалуйста, заполните имя и телефон или email.';
        statusEl.className = 'footer-form-status is-error';
        const firstInvalid = form.querySelector(':invalid');
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      submitBtn.disabled = true;
      submitLabel.textContent = 'Отправляем…';
      statusEl.textContent = '';
      statusEl.className = 'footer-form-status';

      // Имитация отправки — на бэкенде пока нет реального приёма заявок
      window.setTimeout(() => {
        submitLabel.textContent = 'Отправить заявку';
        submitBtn.disabled = false;
        statusEl.textContent = 'Заявка отправлена. Мы свяжемся с вами в ближайшее время.';
        statusEl.className = 'footer-form-status is-success';
        form.reset();
        fields.forEach((field) => field.classList.remove('touched'));
      }, 650);
    });
  }

  /* ---------- 12. ИНИЦИАЛИЗАЦИЯ ---------- */

  function init() {
    initPreloader();
    initHeroReveal();
    initScrollReveal();
    initMobileMenu();
    initSmoothScroll();
    initMagneticButtons();
    initDeviceTilt();
    initSpotlightCursor();
    initDepthParallax();
    initDetailsTrack();
    initFaqAccordion();
    initBookingForm();

    updateHeaderState();
    window.addEventListener('scroll', onScrollHeader, { passive: true });
    window.addEventListener('resize', () => {
      if (!headerTicking) {
        requestAnimationFrame(updateHeaderState);
        headerTicking = true;
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
