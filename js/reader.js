/**
 * reader.js - Section Reader Module
 *
 * Text-only reader for interview transcript sections.
 * Navigation, zoom, context menu, search, keyboard shortcuts,
 * sepia theme, view toggle (V), localStorage persistence.
 */
(function () {
  'use strict';

  var TOTAL_PAGES = 14;
  var ZOOM_LEVELS = [70, 80, 90, 100, 110, 120, 130, 140];
  var VIEW_MODES = ['full', 'transcript', 'commentary'];
  var LS_PAGE  = 'ai-reader-page';
  var LS_ZOOM  = 'ai-reader-zoom';
  var LS_VIEW  = 'ai-reader-viewmode';
  var LS_SEPIA = 'ai-reader-sepia';

  var currentPage = 1;
  var zoomLevel = 100;
  var viewMode = 'full'; // 'full' | 'transcript' | 'commentary'
  var sepiaOn = false;
  var contextMenuOpen = false;
  var indicatorTimer = null;

  var els = {};

  function cacheDom() {
    els.pageCounter    = document.getElementById('page-counter');
    els.pageDisplay    = document.getElementById('page-display');
    els.textView       = document.getElementById('text-view');
    els.textContent    = document.getElementById('text-content');
    els.btnPrev        = document.getElementById('btn-prev');
    els.btnNext        = document.getElementById('btn-next');
    els.pageInput      = document.getElementById('page-input');
    els.progressBar    = document.getElementById('progress-bar');
    els.zoomPanel      = document.getElementById('zoom-panel');
    els.contextFab     = document.getElementById('context-fab');
    els.contextMenu    = document.getElementById('context-menu');
    els.ctxPrev        = document.getElementById('ctx-prev');
    els.ctxNext        = document.getElementById('ctx-next');
    els.ctxPageLabel   = document.getElementById('ctx-page-label');
    els.ctxClose       = document.getElementById('ctx-close');
    els.ctxToggleView  = document.getElementById('ctx-toggle-view');
    els.ctxToggleSepia = document.getElementById('ctx-toggle-sepia');
    els.searchInput    = document.getElementById('search-input');
    els.searchResults  = document.getElementById('search-results');
    els.viewIndicator  = document.getElementById('view-indicator');
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function textPath(page) {
    return 'text/section_' + pad(page) + '.html';
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  // ── Persistence ──

  function saveState() {
    try {
      localStorage.setItem(LS_PAGE, String(currentPage));
      localStorage.setItem(LS_ZOOM, String(zoomLevel));
      localStorage.setItem(LS_VIEW, viewMode);
      localStorage.setItem(LS_SEPIA, sepiaOn ? '1' : '0');
    } catch (_) {}
  }

  function loadState() {
    try {
      var savedPage = parseInt(localStorage.getItem(LS_PAGE), 10);
      if (savedPage >= 1 && savedPage <= TOTAL_PAGES) currentPage = savedPage;
      var savedZoom = parseInt(localStorage.getItem(LS_ZOOM), 10);
      if (ZOOM_LEVELS.indexOf(savedZoom) !== -1) zoomLevel = savedZoom;
      var savedView = localStorage.getItem(LS_VIEW);
      if (VIEW_MODES.indexOf(savedView) !== -1) viewMode = savedView;
      sepiaOn = localStorage.getItem(LS_SEPIA) === '1';
    } catch (_) {}
  }

  function parseUrlPage() {
    var params = new URLSearchParams(window.location.search);
    var p = parseInt(params.get('section'), 10);
    if (p >= 1 && p <= TOTAL_PAGES) currentPage = p;
  }

  function updateUrlParam() {
    var url = new URL(window.location);
    url.searchParams.set('section', currentPage);
    history.replaceState(null, '', url);
  }

  // ── Navigation ──

  function goToPage(n) {
    n = clamp(n, 1, TOTAL_PAGES);
    currentPage = n;

    fetchTextContent(n);

    var progress = ((n - 1) / (TOTAL_PAGES - 1)) * 100;
    els.progressBar.style.width = progress + '%';
    els.pageCounter.textContent = 'Section ' + n + ' of ' + TOTAL_PAGES;
    els.pageInput.value = n;
    els.ctxPageLabel.textContent = 'Section ' + n;

    updateUrlParam();
    saveState();

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function fetchTextContent(page) {
    els.textContent.innerHTML = '<p style="color:#5f6368;">Loading...</p>';
    fetch(textPath(page))
      .then(function (res) {
        if (!res.ok) throw new Error('Not found');
        return res.text();
      })
      .then(function (html) {
        els.textContent.innerHTML = html;
      })
      .catch(function () {
        els.textContent.innerHTML =
          '<p style="color:#d93025;">Content not available for this section.</p>';
      });
  }

  // ── Zoom ──

  function setZoom(level) {
    if (ZOOM_LEVELS.indexOf(level) === -1) return;
    zoomLevel = level;
    els.pageDisplay.style.transform = 'scale(' + (level / 100) + ')';
    var buttons = els.zoomPanel.querySelectorAll('.zoom-btn');
    buttons.forEach(function (btn) {
      btn.classList.toggle('active', parseInt(btn.dataset.zoom, 10) === level);
    });
    saveState();
  }

  // ── View Toggle (V key) ──

  function viewLabel(mode) {
    if (mode === 'transcript') return 'Transcript Only';
    if (mode === 'commentary') return 'Commentary Only';
    return 'Full View';
  }

  function applyViewMode() {
    document.body.classList.remove('view-transcript', 'view-commentary');
    if (viewMode === 'transcript') document.body.classList.add('view-transcript');
    if (viewMode === 'commentary') document.body.classList.add('view-commentary');

    // Update context menu button text
    if (els.ctxToggleView) {
      var next = VIEW_MODES[(VIEW_MODES.indexOf(viewMode) + 1) % VIEW_MODES.length];
      els.ctxToggleView.textContent = 'Switch to ' + viewLabel(next);
    }
  }

  function cycleViewMode() {
    var idx = VIEW_MODES.indexOf(viewMode);
    viewMode = VIEW_MODES[(idx + 1) % VIEW_MODES.length];
    applyViewMode();
    showIndicator(viewLabel(viewMode));
    saveState();
  }

  function showIndicator(text) {
    els.viewIndicator.textContent = text;
    els.viewIndicator.classList.add('visible');
    clearTimeout(indicatorTimer);
    indicatorTimer = setTimeout(function () {
      els.viewIndicator.classList.remove('visible');
    }, 1500);
  }

  // ── Sepia ──

  function applySepia() {
    document.body.classList.toggle('sepia', sepiaOn);
    if (els.ctxToggleSepia) {
      els.ctxToggleSepia.textContent = sepiaOn ? 'Default Theme' : 'Sepia Theme';
    }
  }

  function toggleSepia() {
    sepiaOn = !sepiaOn;
    applySepia();
    showIndicator(sepiaOn ? 'Sepia On' : 'Sepia Off');
    saveState();
  }

  // ── Context Menu ──

  function openContextMenu() {
    contextMenuOpen = true;
    els.contextMenu.style.display = 'flex';
    els.searchInput.value = '';
    els.searchResults.innerHTML = '';
  }

  function closeContextMenu() {
    contextMenuOpen = false;
    els.contextMenu.style.display = 'none';
  }

  function toggleContextMenu() {
    contextMenuOpen ? closeContextMenu() : openContextMenu();
  }

  // ── Search ──

  function performSearch(query) {
    els.searchResults.innerHTML = '';
    if (!query || query.length < 2) return;
    if (!window.pagesData || !Array.isArray(window.pagesData)) return;

    var lower = query.toLowerCase();
    var matches = [];

    for (var i = 0; i < window.pagesData.length && matches.length < 5; i++) {
      var entry = window.pagesData[i];
      var title = (entry.title || '').toLowerCase();
      var text = (entry.searchText || '').toLowerCase();
      if (title.indexOf(lower) !== -1 || text.indexOf(lower) !== -1) {
        matches.push(entry);
      }
    }

    matches.forEach(function (entry) {
      var li = document.createElement('li');
      li.innerHTML =
        '<span class="result-page">' + entry.page + '.</span>' +
        '<span class="result-title">' + escapeHtml(entry.title || 'Untitled') + '</span>';
      li.addEventListener('click', function () {
        goToPage(entry.page);
        closeContextMenu();
      });
      els.searchResults.appendChild(li);
    });
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Keyboard Shortcuts ──

  function handleKeydown(e) {
    var tag = (e.target.tagName || '').toLowerCase();
    var isInput = tag === 'input' || tag === 'textarea';

    if (e.key === 'Escape') { closeContextMenu(); return; }

    if (isInput && e.target === els.pageInput && e.key === 'Enter') {
      var val = parseInt(els.pageInput.value, 10);
      if (val >= 1 && val <= TOTAL_PAGES) goToPage(val);
      return;
    }

    if (isInput) return;

    switch (e.key) {
      case 'ArrowLeft':  e.preventDefault(); goToPage(currentPage - 1); break;
      case 'ArrowRight': e.preventDefault(); goToPage(currentPage + 1); break;
      case 'v': case 'V': cycleViewMode(); break;
      case 's': case 'S': toggleSepia(); break;
      case 'm': case 'M': toggleContextMenu(); break;
    }
  }

  // ── Event Binding ──

  function bindEvents() {
    els.btnPrev.addEventListener('click', function () { goToPage(currentPage - 1); });
    els.btnNext.addEventListener('click', function () { goToPage(currentPage + 1); });

    els.pageInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var val = parseInt(els.pageInput.value, 10);
        if (val >= 1 && val <= TOTAL_PAGES) goToPage(val);
      }
    });

    els.zoomPanel.addEventListener('click', function (e) {
      var btn = e.target.closest('.zoom-btn');
      if (btn && btn.dataset.zoom) setZoom(parseInt(btn.dataset.zoom, 10));
    });

    els.contextFab.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleContextMenu();
    });

    els.contextMenu.addEventListener('click', function (e) {
      if (e.target === els.contextMenu) closeContextMenu();
    });

    els.ctxPrev.addEventListener('click', function () { goToPage(currentPage - 1); });
    els.ctxNext.addEventListener('click', function () { goToPage(currentPage + 1); });
    els.ctxToggleView.addEventListener('click', function () { cycleViewMode(); });
    els.ctxToggleSepia.addEventListener('click', function () { toggleSepia(); });
    els.ctxClose.addEventListener('click', function () { closeContextMenu(); });

    els.searchInput.addEventListener('input', function () {
      performSearch(els.searchInput.value.trim());
    });

    document.addEventListener('keydown', handleKeydown);
  }

  // ── Init ──

  function init() {
    cacheDom();
    loadState();
    parseUrlPage();
    setZoom(zoomLevel);
    applyViewMode();
    applySepia();
    goToPage(currentPage);
    bindEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
