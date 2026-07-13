"use strict";

const SHOWCASE_TOPIC = "showcase";

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cleanTopics(topics = []) {
  return topics.filter(topic => topic.toLowerCase() !== SHOWCASE_TOPIC);
}

function buildProjectCatalog({ owner, repositories, existing = {} }) {
  const previousProjects = new Map((existing.projects ?? []).map(project => [project.repo, project]));

  const projects = repositories
    .filter(repository => {
      const hasShowcaseTopic = (repository.topics ?? []).some(topic => topic.toLowerCase() === SHOWCASE_TOPIC);
      const hasDescription = typeof repository.description === "string" && repository.description.trim().length > 0;

      return hasShowcaseTopic
        && hasDescription
        && !repository.private
        && !repository.fork
        && !repository.archived
        && !repository.disabled
        && repository.full_name !== `${owner}/blog`;
    })
    .map(repository => {
      const previous = previousProjects.get(repository.full_name) ?? {};
      const project = {
        repo: repository.full_name,
        name: repository.name,
        description: previous.description || repository.description.trim(),
        topics: cleanTopics(repository.topics ?? []),
        source: repository.html_url,
        updatedAt: repository.pushed_at,
      };

      if (repository.language) project.language = repository.language;
      if (isHttpUrl(repository.homepage)) project.homepage = repository.homepage;
      if (previous.title) project.title = previous.title;
      if (isHttpUrl(previous.cover)) project.cover = previous.cover;

      return project;
    })
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));

  return { owner, projects };
}

function renderProjectCards(projects) {
  if (!projects.length) {
    return '<p class="projects-empty">暂时还没有公开展示的项目。</p>';
  }

  return `<div class="project-grid">\n${projects.map(project => {
    const title = escapeHtml(project.title || project.name);
    const description = escapeHtml(project.description);
    const meta = [project.language, ...(project.topics ?? [])].filter(Boolean).map(escapeHtml).join(" · ");
    const cover = isHttpUrl(project.cover)
      ? `    <img class="project-card-cover nolazyload" src="${escapeHtml(project.cover)}" alt="${title} 项目预览">\n`
      : "";
    const homepage = isHttpUrl(project.homepage)
      ? `        <a class="project-card-primary" href="${escapeHtml(project.homepage)}" target="_blank" rel="noopener">在线访问</a>\n`
      : "";
    const source = isHttpUrl(project.source)
      ? `        <a class="project-card-secondary" href="${escapeHtml(project.source)}" target="_blank" rel="noopener">查看源码</a>`
      : "";

    return [
      "  <article class=\"project-card\">",
      cover.trimEnd(),
      "    <div class=\"project-card-body\">",
      "      <p class=\"project-card-eyebrow\">GitHub 项目</p>",
      `      <h3>${title}</h3>`,
      meta ? `      <p class="project-card-stack">${meta}</p>` : "",
      `      <p>${description}</p>`,
      "      <div class=\"project-card-actions\">",
      homepage.trimEnd(),
      source,
      "      </div>",
      "    </div>",
      "  </article>",
    ].filter(Boolean).join("\n");
  }).join("\n")}\n</div>`;
}

function replaceProjectSection(markdown, cards) {
  const start = "<!-- projects:auto:start -->";
  const end = "<!-- projects:auto:end -->";
  const startIndex = markdown.indexOf(start);
  const endIndex = markdown.indexOf(end);

  if (startIndex < 0 || endIndex < 0 || endIndex < startIndex) {
    throw new Error("Project page is missing the automatic content markers.");
  }

  const before = markdown.slice(0, startIndex + start.length);
  const after = markdown.slice(endIndex);
  return `${before}\n\n${cards}\n\n${after}`;
}

module.exports = {
  buildProjectCatalog,
  renderProjectCards,
  replaceProjectSection,
};
