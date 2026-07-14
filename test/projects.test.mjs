import assert from 'node:assert/strict';
import test from 'node:test';
import projects from '../tools/projects.js';

const { buildProjectCatalog, renderProjectCards, replaceProjectSection } = projects;

const repository = (overrides = {}) => ({
  name: 'voxel-world',
  full_name: 'yxc1130/voxel-world',
  private: false,
  fork: false,
  archived: false,
  disabled: false,
  description: 'A browser-based voxel survival experiment.',
  topics: ['showcase', 'threejs', 'webgl'],
  html_url: 'https://github.com/yxc1130/voxel-world',
  homepage: 'https://yxc1130.github.io/voxel-world/',
  language: 'JavaScript',
  pushed_at: '2026-07-13T04:00:00Z',
  ...overrides,
});

test('buildProjectCatalog keeps only finished public showcase repositories', () => {
  const catalog = buildProjectCatalog({
    owner: 'yxc1130',
    repositories: [
      repository(),
      repository({ name: 'blog', full_name: 'yxc1130/blog' }),
      repository({ name: 'private-project', private: true }),
      repository({ name: 'forked-project', fork: true }),
      repository({ name: 'archived-project', archived: true }),
      repository({ name: 'disabled-project', disabled: true }),
      repository({ name: 'unmarked-project', topics: ['threejs'] }),
      repository({ name: 'missing-description', description: '   ' }),
    ],
  });

  assert.deepEqual(catalog.projects.map(project => project.repo), ['yxc1130/voxel-world']);
});

test('buildProjectCatalog includes a curated public repository without the showcase topic', () => {
  const catalog = buildProjectCatalog({
    owner: 'yxc1130',
    existing: {
      projects: [{
        repo: 'yxc1130/lumen-atelier',
        include: true,
        title: 'Lumen Atelier',
        description: '本地运行的 AI 图像生成工作台。',
      }],
    },
    repositories: [repository({
      name: 'lumen-atelier',
      full_name: 'yxc1130/lumen-atelier',
      description: 'A local AI image workspace.',
      topics: ['javascript'],
      homepage: '',
      html_url: 'https://github.com/yxc1130/lumen-atelier',
    })],
  });

  assert.deepEqual(catalog.projects, [{
    repo: 'yxc1130/lumen-atelier',
    name: 'lumen-atelier',
    include: true,
    title: 'Lumen Atelier',
    description: '本地运行的 AI 图像生成工作台。',
    language: 'JavaScript',
    topics: ['javascript'],
    source: 'https://github.com/yxc1130/lumen-atelier',
    updatedAt: '2026-07-13T04:00:00Z',
  }]);
});

test('buildProjectCatalog preserves a curated homepage when GitHub has none', () => {
  const catalog = buildProjectCatalog({
    owner: 'yxc1130',
    existing: {
      projects: [{
        repo: 'yxc1130/yxc1130.github.io',
        include: true,
        homepage: 'https://yxc1130.github.io/',
      }],
    },
    repositories: [repository({
      name: 'yxc1130.github.io',
      full_name: 'yxc1130/yxc1130.github.io',
      homepage: '',
      html_url: 'https://github.com/yxc1130/yxc1130.github.io',
    })],
  });

  assert.equal(catalog.projects[0].homepage, 'https://yxc1130.github.io/');
});

test('buildProjectCatalog preserves a curated cover and normalizes GitHub data', () => {
  const catalog = buildProjectCatalog({
    owner: 'yxc1130',
    existing: {
      projects: [{
        repo: 'yxc1130/voxel-world',
        cover: 'https://images.example.test/voxel-cover.png',
      }],
    },
    repositories: [repository({ topics: ['WebGL', 'SHOWCASE', 'threejs'] })],
  });

  assert.deepEqual(catalog, {
    owner: 'yxc1130',
    projects: [{
      repo: 'yxc1130/voxel-world',
      name: 'voxel-world',
      description: 'A browser-based voxel survival experiment.',
      language: 'JavaScript',
      topics: ['WebGL', 'threejs'],
      source: 'https://github.com/yxc1130/voxel-world',
      homepage: 'https://yxc1130.github.io/voxel-world/',
      cover: 'https://images.example.test/voxel-cover.png',
      updatedAt: '2026-07-13T04:00:00Z',
    }],
  });
});

test('replaceProjectSection changes only the marked automatic project section', () => {
  const page = [
    '# 项目集',
    '<!-- projects:auto:start -->',
    '旧项目内容',
    '<!-- projects:auto:end -->',
    '项目说明保持不变',
  ].join('\n');

  assert.equal(
    replaceProjectSection(page, '<div>新项目内容</div>'),
    [
      '# 项目集',
      '<!-- projects:auto:start -->',
      '',
      '<div>新项目内容</div>',
      '',
      '<!-- projects:auto:end -->',
      '项目说明保持不变',
    ].join('\n')
  );
});

test('renderProjectCards escapes repository content and renders valid actions', () => {
  const html = renderProjectCards([{ 
    repo: 'yxc1130/safe-project',
    name: '<unsafe>',
    description: 'Build <strong>carefully</strong>.',
    language: 'Python',
    topics: ['showcase', '<script>'],
    source: 'https://github.com/yxc1130/safe-project',
    homepage: 'https://example.test/demo',
    cover: 'https://example.test/cover.png',
    updatedAt: '2026-07-13T04:00:00Z',
  }]);

  assert.match(html, /&lt;unsafe&gt;/);
  assert.match(html, /Build &lt;strong&gt;carefully&lt;\/strong&gt;\./);
  assert.match(html, /https:\/\/example\.test\/demo/);
  assert.match(html, /https:\/\/github\.com\/yxc1130\/safe-project/);
  assert.doesNotMatch(html, /<script>/);
});
