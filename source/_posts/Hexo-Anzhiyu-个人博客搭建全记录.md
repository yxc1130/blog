---
title: Hexo + Anzhiyu 个人博客搭建全记录
date: 2026-07-12 18:59:20
tags:
  - Hexo
  - Anzhiyu
  - 博客搭建
  - GitHub Pages
categories:
  - 建站教程
description: 从零开始搭建 Hexo + Anzhiyu 主题的个人博客，涵盖主题配置、功能定制、部署到 GitHub Pages 的完整流程。
---

## 为什么选 Hexo + Anzhiyu

在众多静态博客方案中，Hexo 生态成熟、插件丰富、中文社区活跃。而在大量的 Hexo 主题中，[Anzhiyu](https://github.com/anzhiyu-c/hexo-theme-anzhiyu)（安知鱼）凭借极致的细节打磨脱颖而出。

最初在 [crosery.cn](https://crosery.cn) 看到这个主题时就被打动了：毛玻璃导航栏、平滑的页面过渡、内置音乐播放器、丰富的一图流与相册功能。它不只是好看，是把"博客浏览体验"这件事做到了很高的水准。

## 环境准备

确保已安装 Node.js（推荐 18+）和 Git：

```bash
node -v   # v18.20.4
git --version  # git version 2.45.0
npm -v  # 10.7.0
```

## 初始化 Hexo

```bash
# 安装 hexo 脚手架
npm install -g hexo-cli

# 初始化博客目录
hexo init blog
cd blog

# 安装依赖
npm install
```

此时运行 `hexo server`，访问 `http://localhost:4000` 应该能看到默认的 landscape 主题页面。

## 安装 Anzhiyu 主题

推荐使用 npm 安装，方便后续升级：

```bash
npm install hexo-theme-anzhiyu
```

然后修改根目录 `_config.yml`：

```yaml
theme: anzhiyu
```

Anzhiyu 主题还依赖额外的渲染器和插件，一并安装：

```bash
npm install hexo-renderer-pug hexo-renderer-stylus
npm install hexo-wordcount hexo-generator-search hexo-generator-feed
npm install hexo-abbrlink hexo-deployer-git
```

其中 `hexo-abbrlink` 用于生成不变的短链接，比默认的数字 ID 更友好。

## 主题配置精要

Anzhiyu 的配置文件位于 `_config.anzhiyu.yml`（首次需从 `node_modules/hexo-theme-anzhiyu/_config.yml` 复制）。以下是核心配置项：

### 导航菜单

```yaml
menu:
  首页: / || icon-home
  分类: /categories/ || icon-category
  标签: /tags/ || icon-tag
  归档: /archives/ || icon-archive
  相册: /gallery/ || icon-image
  音乐: /music/ || icon-music
  友链: /link/ || icon-link
  关于: /about/ || icon-user
```

### 搜索功能

```yaml
# 本地搜索
local_search:
  enable: true
  preload: true
  top_n_per_article: 1
```

需要在 `_config.yml` 中确认搜索插件配置：

```yaml
search:
  path: search.xml
  field: post
  content: true
```

### PJAX 与页面过渡

```yaml
pjax:
  enable: true
```

PJAX 实现无刷新页面跳转，配合 Anzhiyu 内置的加载动画，浏览体验非常连贯。

### 音乐播放器

Anzhiyu 内置 APlayer 播放器，配置方式：

```yaml
aplayer:
  enable: true
  meting: true
  # 使用 MetingJS 解析网易云等平台歌单
  meting_api: https://api.injahow.cn/meting/
  server: netease
  type: playlist
  id: "歌单ID"
```

MetingJS 可以通过歌单 ID 拉取网易云歌曲列表，不需要自行维护音频文件。

### 社交与头像

```yaml
avatar:
  img: /images/avatar.webp
  effect: true  # 头像旋转效果

social:
  GitHub: https://github.com/yourname || icon-github
  Email: mailto:you@example.com || icon-email
```

### 文章相关

```yaml
# 代码高亮
highlight_theme: mac  # 可选: mac, mac-light, darker

# 版权声明
post_copyright:
  enable: true
  license: CC BY-NC-SA 4.0

# 封面图
cover:
  default_cover: /images/default-cover.webp

# 评论（可选 Twikoo / Waline / Artalk）
comments:
  use: Twikoo
  twikoo:
    envId: 你的环境ID
```

## 部署到 GitHub Pages

### 1. 创建仓库

在 GitHub 创建 `username.github.io` 仓库（username 替换为你的 GitHub 用户名）。

### 2. 配置部署

修改 `_config.yml`：

```yaml
deploy:
  type: git
  repo: https://github.com/username/username.github.io.git
  branch: main
```

### 3. 执行部署

```bash
# 清理 + 生成 + 部署三合一
hexo clean && hexo generate && hexo deploy
```

等待几分钟后，访问 `https://username.github.io` 即可看到博客。

推荐的自动化方式是建一个 alias 或 npm script：

```json
// package.json
{
  "scripts": {
    "deploy": "hexo clean && hexo generate && hexo deploy",
    "new": "hexo new post"
  }
}
```

### 4. 自定义域名（可选）

在 `source/` 目录下创建 `CNAME` 文件，内容写入你的域名。然后在 DNS 服务商添加 CNAME 记录指向 `username.github.io`。

## 常用写作命令

```bash
# 新建文章
hexo new post "文章标题"

# 新建页面（关于、友链等）
hexo new page about

# 本地预览（支持草稿）
hexo server --draft

# 将草稿发布为正式文章
hexo publish post "文章标题"

# 生成静态文件
hexo generate

# 部署
hexo deploy
```

## 踩坑记录

1. **Node 版本过高导致 stylus 编译失败**：降级到 Node 18 或使用 `node-sass` 替代方案
2. **PJAX 与第三方脚本冲突**：在自定义 js 中使用 `document.addEventListener('pjax:complete', callback)` 重新初始化
3. **GitHub Pages 部署 404**：检查仓库 Settings -> Pages 中 Source 分支是否选对
4. **图片加载慢**：使用 `.webp` 格式并压缩，或者用图床 CDN

## 总结

Hexo + Anzhiyu 的组合在 2026 年依然是个人博客搭建的优秀选择。整个流程从零到上线，熟悉的话半小时内可以完成。Anzhiyu 主题的颜值和细节确实能让写博客这件事变得更有动力。
