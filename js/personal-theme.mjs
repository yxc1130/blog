export const AVATAR_PATH = '/blog/img/yxc-avatar.jpg';
export const AVATAR_SMALL_PATH = '/blog/img/yxc-avatar-320.jpg';
export const THEME_STORAGE_KEY = 'yxc-theme';
const NATIVE_THEME_STORAGE_KEY = 'theme';

const isTheme = value => value === 'light' || value === 'dark';

export function getStoredTheme(storage) {
  const value = storage.getItem(THEME_STORAGE_KEY);
  return isTheme(value) ? value : undefined;
}

export function storeTheme(storage, theme) {
  if (!isTheme(theme)) return;
  storage.setItem(THEME_STORAGE_KEY, theme);
  storage.setItem(
    NATIVE_THEME_STORAGE_KEY,
    JSON.stringify({ value: theme, expiry: Date.now() + 3650 * 86400000 }),
  );
}

export function applyTheme(documentElement, theme) {
  if (!isTheme(theme)) return;
  documentElement.setAttribute('data-theme', theme);
}

export function createMobileMenuController({ document, menu, toggle, manageHidden = true }) {
  const updateToggle = expanded => {
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.setAttribute('aria-label', expanded ? '关闭导航菜单' : '打开导航菜单');
  };

  const close = () => {
    if (manageHidden) menu.hidden = true;
    menu.classList?.remove('open');
    updateToggle(false);
    document.removeEventListener('keydown', onKeydown, true);
    toggle.focus();
  };

  const onKeydown = event => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    close();
  };

  const open = () => {
    if (manageHidden) menu.hidden = false;
    menu.classList?.add('open');
    updateToggle(true);
    document.addEventListener('keydown', onKeydown, true);
    menu.querySelector('a, button, [tabindex]:not([tabindex="-1"])')?.focus();
  };

  return { close, open };
}

function createAvatar(className = 'personal-home-portrait') {
  const portrait = document.createElement('a');
  portrait.className = className;
  portrait.href = '/blog/about/';
  portrait.setAttribute('aria-label', '查看 yxc 的个人介绍');

  const image = document.createElement('img');
  image.src = AVATAR_PATH;
  image.srcset = `${AVATAR_SMALL_PATH} 320w, ${AVATAR_PATH} 960w`;
  image.sizes = '(max-width: 768px) 136px, 192px';
  image.width = 960;
  image.height = 960;
  image.alt = 'yxc 的头像';
  image.decoding = 'async';
  image.fetchPriority = 'high';
  image.addEventListener('error', () => {
    portrait.classList.add('is-image-error');
    image.alt = 'yxc 头像加载失败';
  }, { once: true });

  portrait.append(image);
  return portrait;
}

function ensureHomePortrait() {
  const siteInfo = document.getElementById('site-info');
  if (siteInfo && !siteInfo.querySelector('.personal-home-portrait')) {
    siteInfo.prepend(createAvatar());
  }

  const banner = document.getElementById('random-banner');
  if (banner && !banner.querySelector('.personal-banner-portrait')) {
    banner.append(createAvatar('personal-banner-portrait'));
  }
}

function updateThemeButton(button) {
  const currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
  const label = `切换到${nextTheme === 'dark' ? '深色' : '浅色'}模式`;
  button.setAttribute('aria-label', label);
  button.setAttribute('title', label);
  button.setAttribute('aria-pressed', String(currentTheme === 'dark'));
  button.innerHTML = `<i class="anzhiyufont ${currentTheme === 'dark' ? 'anzhiyu-icon-sun' : 'anzhiyu-icon-moon'}" aria-hidden="true"></i><span class="sr-only">${label}</span>`;
}

function ensureThemeButton() {
  const navRight = document.getElementById('nav-right');
  if (!navRight || document.getElementById('personal-theme-toggle')) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'personal-theme-toggle';
  button.className = 'personal-nav-button';
  button.addEventListener('click', () => {
    const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(document.documentElement, theme);
    storeTheme(window.localStorage, theme);
    window.handleThemeChange?.(theme);
    updateThemeButton(button);
  });

  const menuToggle = document.getElementById('toggle-menu');
  navRight.insertBefore(button, menuToggle || null);
  updateThemeButton(button);
}

function enhanceMobileMenu() {
  const toggle = document.querySelector('#toggle-menu a');
  const menu = document.getElementById('sidebar-menus');
  const mask = document.getElementById('menu-mask');
  if (!toggle || !menu || toggle.dataset.personalMenuReady) return;

  toggle.dataset.personalMenuReady = 'true';
  toggle.setAttribute('role', 'button');
  toggle.setAttribute('aria-controls', 'sidebar-menus');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', '打开导航菜单');
  menu.setAttribute('role', 'dialog');
  menu.setAttribute('aria-modal', 'true');
  menu.setAttribute('aria-label', '网站导航');

  const closeMenu = () => {
    if (!menu.classList.contains('open')) return;
    mask?.click();
    menu.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', '打开导航菜单');
    toggle.focus();
  };

  const openMenu = () => {
    menu.classList.add('open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', '关闭导航菜单');
    menu.querySelector('a, button, [tabindex]:not([tabindex="-1"])')?.focus();
  };

  const closeOnEscape = event => {
    if (event.key !== 'Escape' || !menu.classList.contains('open')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    closeMenu();
  };
  document.addEventListener('keydown', closeOnEscape, true);
  document.addEventListener('keyup', closeOnEscape, true);
  window.addEventListener('keydown', closeOnEscape, true);
  window.addEventListener('keyup', closeOnEscape, true);

  toggle.addEventListener('click', event => {
    event.preventDefault();
    window.setTimeout(() => {
      menu.classList.contains('open') ? openMenu() : closeMenu();
    });
  });
  mask?.addEventListener('click', closeMenu);
}

function syncSidebarTheme() {
  document.querySelectorAll('.darkmode_switchbutton').forEach(button => {
    if (button.dataset.personalThemeReady) return;
    button.dataset.personalThemeReady = 'true';
    button.addEventListener('click', () => {
      window.setTimeout(() => {
        const theme = document.documentElement.getAttribute('data-theme');
        if (isTheme(theme)) storeTheme(window.localStorage, theme);
      });
    });
  });
}

function initialise() {
  ensureHomePortrait();
  ensureThemeButton();
  enhanceMobileMenu();
  syncSidebarTheme();
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initialise);
  document.addEventListener('pjax:complete', initialise);
}
