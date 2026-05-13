/* ============================================================
   WAWA ERP Mockup v2 — Interaction layer
   Mock data, no backend. Vanilla JS, no dependencies.
   ============================================================ */
(function (global) {
  'use strict';

  // ===== Toast ============================================================
  const Toast = (() => {
    let root = null;
    function ensure() {
      if (root) return root;
      root = document.createElement('div');
      root.className = 'app-toast-root';
      Object.assign(root.style, {
        position: 'fixed', top: '24px', left: '50%', transform: 'translateX(-50%)',
        zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px',
        pointerEvents: 'none',
      });
      document.body.appendChild(root);
      return root;
    }
    function show(msg, kind = 'info') {
      const node = document.createElement('div');
      const palette = {
        info:    { bg: 'var(--text-primary)',    fg: 'var(--text-inverse)' },
        success: { bg: 'var(--success)',         fg: 'var(--text-inverse)' },
        warning: { bg: 'var(--warning)',         fg: 'var(--text-inverse)' },
        danger:  { bg: 'var(--danger)',          fg: 'var(--text-inverse)' },
      }[kind] || { bg: 'var(--text-primary)', fg: 'var(--text-inverse)' };
      Object.assign(node.style, {
        background: palette.bg, color: palette.fg,
        padding: '10px 18px', borderRadius: '999px',
        fontSize: '13px', fontWeight: 700,
        boxShadow: '0 8px 24px rgba(26,30,46,0.16)',
        letterSpacing: '-0.005em',
        pointerEvents: 'auto', maxWidth: '480px',
        animation: 'app-toast-in 240ms cubic-bezier(0.16,1,0.3,1)',
      });
      node.textContent = msg;
      ensure().appendChild(node);
      setTimeout(() => {
        node.style.animation = 'app-toast-out 200ms ease-in forwards';
        setTimeout(() => node.remove(), 220);
      }, 2200);
    }
    return { show };
  })();

  // inject toast keyframes once
  (function injectStyles() {
    const css = `
      @keyframes app-toast-in { from { transform: translateY(-12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      @keyframes app-toast-out { from { opacity: 1; } to { opacity: 0; transform: translateY(-6px); } }
      .app-modal-overlay { position: fixed; inset: 0; background: rgba(26,30,46,0.45); display: grid; place-items: center; z-index: 9000; animation: app-toast-in 200ms cubic-bezier(0.16,1,0.3,1); }
      .app-modal { background: var(--bg-secondary); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); max-width: 520px; width: 92%; max-height: 85vh; overflow: hidden; display: flex; flex-direction: column; }
      .app-modal__head { padding: var(--sp-5) var(--sp-6); border-bottom: 1px solid var(--border-secondary); display: flex; align-items: center; justify-content: space-between; }
      .app-modal__title { margin: 0; font-size: var(--fs-19); font-weight: 800; letter-spacing: -0.01em; }
      .app-modal__close { background: transparent; border: none; cursor: pointer; padding: 4px; border-radius: var(--radius-xs); color: var(--text-tertiary); }
      .app-modal__close:hover { background: var(--bg-tertiary); color: var(--text-primary); }
      .app-modal__body { padding: var(--sp-5) var(--sp-6); overflow-y: auto; }
      .app-modal__footer { padding: var(--sp-4) var(--sp-6); border-top: 1px solid var(--border-secondary); display: flex; gap: var(--sp-2); justify-content: flex-end; background: var(--bg-primary); }
      .app-hidden { display: none !important; }
    `;
    const tag = document.createElement('style');
    tag.textContent = css;
    document.head.appendChild(tag);
  })();

  // ===== Modal ============================================================
  const Modal = (() => {
    let active = null;
    function open({ title, body, footer, onClose } = {}) {
      close();
      const overlay = document.createElement('div');
      overlay.className = 'app-modal-overlay';
      overlay.innerHTML = `
        <div class="app-modal" role="dialog" aria-modal="true">
          <header class="app-modal__head">
            <h2 class="app-modal__title">${title || ''}</h2>
            <button class="app-modal__close" aria-label="닫기">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </header>
          <div class="app-modal__body">${body || ''}</div>
          ${footer ? `<footer class="app-modal__footer">${footer}</footer>` : ''}
        </div>
      `;
      document.body.appendChild(overlay);
      active = { overlay, onClose };

      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
      overlay.querySelector('.app-modal__close').addEventListener('click', close);
      document.addEventListener('keydown', escClose);
      // re-render lucide inside modal
      if (global.lucide) global.lucide.createIcons({ icons: undefined, attrs: {} });
      return overlay;
    }
    function escClose(e) { if (e.key === 'Escape') close(); }
    function close() {
      if (!active) return;
      const { overlay, onClose } = active;
      document.removeEventListener('keydown', escClose);
      overlay.remove();
      active = null;
      if (onClose) onClose();
    }
    return { open, close };
  })();

  // ===== Wiring helpers ===================================================
  function bindTabs(container = document) {
    container.querySelectorAll('.tabs').forEach((tabsEl) => {
      const items = tabsEl.querySelectorAll('.tabs__item, .mat-tabs__item, .detail-tabs__item');
      items.forEach((item) => {
        item.addEventListener('click', () => {
          items.forEach((x) => x.classList.remove('is-active'));
          item.classList.add('is-active');
          const label = item.textContent.trim().replace(/\s+\d+$/, '');
          Toast.show(`'${label}' 탭`);
        });
      });
    });
    // Generic mat-tabs / detail-tabs wrappers without `.tabs` parent
    ['.mat-tabs', '.detail-tabs'].forEach((sel) => {
      container.querySelectorAll(sel).forEach((wrap) => {
        const items = wrap.querySelectorAll('.mat-tabs__item, .detail-tabs__item');
        items.forEach((item) => {
          if (item.dataset._wired) return;
          item.dataset._wired = '1';
          item.addEventListener('click', () => {
            items.forEach((x) => x.classList.remove('is-active'));
            item.classList.add('is-active');
          });
        });
      });
    });
  }

  function bindChipGroups(container = document) {
    // .filter-row 또는 .filters-row 내부의 .chip / .filter-chip 단일 선택
    container.querySelectorAll('.filters-row, .filter-row').forEach((row) => {
      const chips = row.querySelectorAll('.chip, .filter-chip');
      chips.forEach((chip) => {
        chip.addEventListener('click', () => {
          chips.forEach((x) => x.classList.remove('is-on', 'is-active'));
          // .chip uses .is-on, .filter-chip uses .is-active
          chip.classList.add(chip.classList.contains('filter-chip') ? 'is-active' : 'is-on');
          Toast.show(`필터: ${chip.textContent.trim().split('\n')[0]}`);
        });
      });
    });
  }

  function bindScopeToggle(container = document) {
    container.querySelectorAll('.scope-toggle').forEach((group) => {
      const btns = group.querySelectorAll('.scope-toggle__btn, .role-switch__btn');
      btns.forEach((b) => {
        b.addEventListener('click', () => {
          btns.forEach((x) => x.classList.remove('is-active'));
          b.classList.add('is-active');
          Toast.show(`범위: ${b.textContent.trim()}`);
        });
      });
    });
  }

  function bindCheckboxes(container = document) {
    container.querySelectorAll('table.data-table, table.matrix-table').forEach((table) => {
      const headCb = table.querySelector('thead input[type="checkbox"]');
      const rowCbs = table.querySelectorAll('tbody input[type="checkbox"]');
      if (headCb) {
        headCb.addEventListener('change', () => {
          rowCbs.forEach((cb) => {
            cb.checked = headCb.checked;
            const tr = cb.closest('tr');
            if (tr) tr.classList.toggle('is-selected', cb.checked);
          });
          updateSelectionCount(table);
        });
      }
      rowCbs.forEach((cb) => {
        cb.addEventListener('change', () => {
          const tr = cb.closest('tr');
          if (tr) tr.classList.toggle('is-selected', cb.checked);
          updateSelectionCount(table);
        });
      });
    });
  }

  function updateSelectionCount(table) {
    const count = table.querySelectorAll('tbody input[type="checkbox"]:checked').length;
    const counter = document.querySelector('[data-selection-count]');
    if (counter) counter.textContent = `${count} 선택`;
  }

  function bindSearch(container = document) {
    container.querySelectorAll('.input-group').forEach((group) => {
      const input = group.querySelector('input');
      if (!input || input.dataset._wired) return;
      input.dataset._wired = '1';
      let timer = null;
      input.addEventListener('input', () => {
        clearTimeout(timer);
        const q = input.value.trim().toLowerCase();
        const targetTable = group.closest('.panel')?.querySelector('table.data-table');
        timer = setTimeout(() => {
          if (!targetTable) return;
          const rows = targetTable.querySelectorAll('tbody tr');
          let hits = 0;
          rows.forEach((tr) => {
            if (!q) { tr.style.display = ''; hits++; return; }
            const text = tr.textContent.toLowerCase();
            const match = text.includes(q);
            tr.style.display = match ? '' : 'none';
            if (match) hits++;
          });
          if (q) Toast.show(`'${input.value}' — ${hits}건`);
        }, 200);
      });
    });
  }

  function bindGenericClicks(container = document) {
    // Catch-all: 모든 .btn / .btn-icon / .quick-action / .mockup-card / .leader-row 등 클릭 → toast
    const selectors = [
      '.btn:not([data-wired])',
      '.btn-icon:not([data-wired])',
      '.quick-action:not([data-wired])',
      '.app-nav__item:not([href]):not([data-wired])',
      '.issue-card:not([data-wired])',
      '.month-picker:not([data-wired])',
      '.list-row__action:not([data-wired])',
      '.preset:not([data-wired])',
      '.deck-card:not([data-wired])',
      '.q-item:not([data-wired])',
      '.pending-row:not([data-wired])',
      '.insert-chip:not([data-wired])',
    ];
    container.querySelectorAll(selectors.join(',')).forEach((el) => {
      // 이미 onclick / data-action 이 있으면 skip
      if (el.dataset.action || el.getAttribute('onclick')) return;
      el.dataset.wired = '1';
      el.addEventListener('click', (e) => {
        if (el.matches('a[href]') && el.getAttribute('href') !== '#') return; // real link
        e.preventDefault();
        const label = (el.getAttribute('aria-label')
          || el.title
          || el.textContent.trim().split('\n')[0]
          || '액션').slice(0, 60);
        Toast.show(label);
        // Visual press feedback
        el.style.transform = 'scale(0.98)';
        setTimeout(() => { el.style.transform = ''; }, 120);
      });
    });
  }

  function bindActions(container = document) {
    // data-action 으로 명시한 곳: 우선 처리
    container.querySelectorAll('[data-action]').forEach((el) => {
      if (el.dataset._wired) return;
      el.dataset._wired = '1';
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const fn = global.AppActions && global.AppActions[el.dataset.action];
        if (typeof fn === 'function') fn(el, e);
        else Toast.show(`action: ${el.dataset.action}`);
      });
    });
  }

  function bindPasswordEye(container = document) {
    container.querySelectorAll('.input-group').forEach((group) => {
      const input = group.querySelector('input[type="password"]');
      const eyeBtn = group.querySelector('.btn-icon');
      if (!input || !eyeBtn || eyeBtn.dataset._eye) return;
      eyeBtn.dataset._eye = '1';
      eyeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        input.type = input.type === 'password' ? 'text' : 'password';
      });
    });
  }

  function bindModalTriggers(container = document) {
    container.querySelectorAll('[data-modal-template]').forEach((trigger) => {
      if (trigger.dataset._wired) return;
      trigger.dataset._wired = '1';
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        const tplId = trigger.dataset.modalTemplate;
        const tpl = document.getElementById(tplId);
        if (!tpl) { Toast.show(`템플릿 없음: ${tplId}`, 'warning'); return; }
        Modal.open({
          title: tpl.dataset.title || '',
          body: tpl.innerHTML,
          footer: tpl.dataset.footer || '',
        });
      });
    });
  }

  function bindFormSubmit(container = document) {
    container.querySelectorAll('form').forEach((form) => {
      if (form.dataset._wired) return;
      form.dataset._wired = '1';
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        Toast.show(form.dataset.successMsg || '제출됨', 'success');
      });
    });
  }

  // ===== Init ============================================================
  const App = {
    Toast, Modal,
    init(container = document) {
      bindActions(container);
      bindTabs(container);
      bindChipGroups(container);
      bindScopeToggle(container);
      bindCheckboxes(container);
      bindSearch(container);
      bindPasswordEye(container);
      bindModalTriggers(container);
      bindFormSubmit(container);
      bindGenericClicks(container);
    },
  };

  global.App = App;
  global.AppToast = Toast;
  global.AppModal = Modal;
  global.AppActions = global.AppActions || {};

  // Auto-init on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
  } else {
    App.init();
  }
})(window);
