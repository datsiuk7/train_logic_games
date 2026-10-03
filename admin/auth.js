/**
 * Password protection for the Admin Panel.
 * Protects editor, categories, levels, and settings pages.
 * Validates password against encrypted SHA-256 hash without exposing plaintext.
 */
(function () {
  const AUTH_HASH = '192f49ec815fd50b252bb7c366b4c1071bffba812f654d0af9eb70a06237c0c2';
  const FALLBACK_HASH = 'a3284b67';
  const STORAGE_KEY = 'lamplighter_admin_auth';

  async function hashPassword(str) {
    if (window.crypto && crypto.subtle) {
      try {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
        return Array.from(new Uint8Array(buf))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
      } catch {}
    }
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16);
  }

  function isAuthorized() {
    try {
      return (
        sessionStorage.getItem(STORAGE_KEY) === AUTH_HASH ||
        localStorage.getItem(STORAGE_KEY) === AUTH_HASH
      );
    } catch {
      return false;
    }
  }

  function setAuthorized() {
    try {
      sessionStorage.setItem(STORAGE_KEY, AUTH_HASH);
      localStorage.setItem(STORAGE_KEY, AUTH_HASH);
    } catch {}
  }

  function logout() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    location.reload();
  }

  function attachLogoutButton() {
    const header = document.querySelector('header');
    if (!header || document.querySelector('#btn-admin-logout')) return;
    const btn = document.createElement('button');
    btn.id = 'btn-admin-logout';
    btn.type = 'button';
    btn.className = 'btn-admin-logout';
    btn.title = 'Вийти з адмін-панелі';
    btn.textContent = 'Вийти ⎋';
    const backLink = header.querySelector('.back');
    if (backLink) {
      header.insertBefore(btn, backLink.nextSibling);
    } else {
      header.appendChild(btn);
    }
    btn.addEventListener('click', logout);
  }

  function setupFullscreenButton() {
    const header = document.querySelector('header');
    if (!header) return;

    let btn = header.querySelector('#admin-fullscreen, #fullscreen, .btn-admin-fullscreen');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'admin-fullscreen';
      btn.type = 'button';
      btn.className = 'quiet btn-admin-fullscreen';
      btn.setAttribute('aria-label', 'Повний екран');
      btn.title = 'Увімкнути повний екран';
      btn.textContent = '⛶ Повний екран';
      const backLink = header.querySelector('.back');
      if (backLink) {
        header.insertBefore(btn, backLink);
      } else {
        header.appendChild(btn);
      }
    }

    function isFullscreen() {
      return Boolean(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
    }

    function update() {
      const fs = isFullscreen();
      btn.setAttribute('aria-pressed', fs ? 'true' : 'false');
      btn.textContent = fs ? '🗗 Згорнути' : '⛶ Повний екран';
      btn.title = fs ? 'Вийти з повного екрана' : 'Увімкнути повний екран';
    }

    btn.onclick = async () => {
      try {
        if (!isFullscreen()) {
          const root = document.documentElement || document.body;
          if (root?.requestFullscreen) await root.requestFullscreen();
          else if (root?.webkitRequestFullscreen) await root.webkitRequestFullscreen();
          else if (root?.msRequestFullscreen) await root.msRequestFullscreen();
        } else {
          if (document.exitFullscreen) await document.exitFullscreen();
          else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
          else if (document.msExitFullscreen) await document.msExitFullscreen();
        }
      } catch {}
      update();
    };

    const addDocListener = (event, fn) => {
      document.addEventListener?.(event, fn);
    };

    addDocListener('fullscreenchange', update);
    addDocListener('webkitfullscreenchange', update);
    addDocListener('mozfullscreenchange', update);
    addDocListener('MSFullscreenChange', update);

    update();
  }

  function attachHeaderButtons() {
    setupFullscreenButton();
    attachLogoutButton();
  }

  // If already logged in, mount header buttons when ready and exit
  if (isAuthorized()) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', attachHeaderButtons);
    } else {
      attachHeaderButtons();
    }
    return;
  }

  // Guard: hide page content immediately before it paints
  const guard = document.createElement('style');
  guard.id = 'admin-auth-guard';
  guard.textContent = 'body > *:not(#admin-auth-overlay) { display: none !important; }';
  (document.head || document.documentElement).appendChild(guard);

  function renderAuthOverlay() {
    if (document.querySelector('#admin-auth-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'admin-auth-overlay';
    overlay.innerHTML = `
      <div class="auth-card">
        <div class="auth-icon" aria-hidden="true">🔒</div>
        <h1 class="auth-title">Вхід до адмінки</h1>
        <p class="auth-subtitle">Введіть пароль для доступу до панелі керування</p>
        <form id="admin-auth-form" autocomplete="off">
          <div class="auth-field">
            <input
              type="password"
              id="admin-auth-password"
              class="auth-input"
              placeholder="Введіть пароль"
              autofocus
              required
            >
          </div>
          <button type="submit" class="auth-submit">Увійти</button>
          <div id="admin-auth-msg" class="auth-msg" style="display:none"></div>
        </form>
        <a href="../" class="auth-back">← Повернутися до гри</a>
      </div>
    `;

    document.body.appendChild(overlay);

    const form = overlay.querySelector('#admin-auth-form');
    const input = overlay.querySelector('#admin-auth-password');
    const msg = overlay.querySelector('#admin-auth-msg');

    setTimeout(() => input.focus(), 60);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const val = input.value.trim();
      if (!val) return;

      const hash = await hashPassword(val);
      if (hash === AUTH_HASH || hash === FALLBACK_HASH) {
        setAuthorized();
        overlay.classList.add('auth-fade-out');
        setTimeout(() => {
          overlay.remove();
          if (guard.parentNode) guard.parentNode.removeChild(guard);
          attachHeaderButtons();
        }, 180);
      } else {
        msg.textContent = 'Невірний пароль';
        msg.style.display = 'block';
        input.classList.add('auth-input-error');
        input.value = '';
        input.focus();
        setTimeout(() => input.classList.remove('auth-input-error'), 400);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderAuthOverlay);
  } else {
    renderAuthOverlay();
  }
})();
