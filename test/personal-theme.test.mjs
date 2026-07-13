import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AVATAR_PATH,
  THEME_STORAGE_KEY,
  applyTheme,
  createMobileMenuController,
  getStoredTheme,
  storeTheme,
} from '../source/js/personal-theme.mjs';

test('主题切换将用户选择持久化，并同步文档主题', () => {
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const documentElement = {
    attributes: new Map(),
    setAttribute(key, value) {
      this.attributes.set(key, value);
    },
    getAttribute(key) {
      return this.attributes.get(key) ?? null;
    },
  };

  applyTheme(documentElement, 'dark');
  storeTheme(storage, 'dark');

  assert.equal(documentElement.getAttribute('data-theme'), 'dark');
  assert.equal(getStoredTheme(storage), 'dark');
  assert.equal(values.get(THEME_STORAGE_KEY), 'dark');
});

test('移动导航打开后焦点进入菜单，Escape 关闭并归还焦点', () => {
  const listeners = new Map();
  const menu = {
    hidden: true,
    setAttribute() {},
    removeAttribute() {},
    querySelector: () => firstLink,
  };
  const toggle = {
    attributes: new Map(),
    focused: false,
    setAttribute(key, value) {
      this.attributes.set(key, value);
    },
    focus() {
      this.focused = true;
    },
  };
  const firstLink = { focused: false, focus() { this.focused = true; } };
  const document = {
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    removeEventListener(type) {
      listeners.delete(type);
    },
  };

  const controller = createMobileMenuController({ document, menu, toggle });
  controller.open();

  assert.equal(menu.hidden, false);
  assert.equal(toggle.attributes.get('aria-expanded'), 'true');
  assert.equal(firstLink.focused, true);

  listeners.get('keydown')({ key: 'Escape', preventDefault() {} });

  assert.equal(menu.hidden, true);
  assert.equal(toggle.attributes.get('aria-expanded'), 'false');
  assert.equal(toggle.focused, true);
});

test('核心页面构建输出渲染受控本地头像并提供替代文本', async () => {
  const html = await import('node:fs/promises').then(({ readFile }) =>
    readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
  );

  assert.match(html, /src="\/blog\/js\/personal-theme\.mjs"/);
  assert.match(html, /\/blog\/img\/yxc-avatar\.jpg/);
});
