"use strict";

const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");
const { buildProjectCatalog, renderProjectCards, replaceProjectSection } = require("./projects.js");

const root = path.resolve(__dirname, "..");
const catalogPath = path.join(root, "source", "_data", "projects.yml");
const pagePath = path.join(root, "source", "projects", "index.md");

function readYaml(filePath) {
  return yaml.load(fs.readFileSync(filePath, "utf8")) ?? {};
}

async function fetchPublicRepositories(owner) {
  const token = process.env.GITHUB_TOKEN;
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "yxc-blog-project-sync",
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  const repositories = [];
  let page = 1;

  while (true) {
    const response = await fetch(
      `https://api.github.com/users/${encodeURIComponent(owner)}/repos?type=public&sort=updated&direction=desc&per_page=100&page=${page}`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`GitHub API request failed (${response.status}): ${await response.text()}`);
    }

    const batch = await response.json();
    repositories.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }

  return repositories;
}

async function main() {
  const existing = readYaml(catalogPath);
  const owner = existing.owner;

  if (!owner || typeof owner !== "string") {
    throw new Error(`${path.relative(root, catalogPath)} must contain a GitHub owner.`);
  }

  const repositories = await fetchPublicRepositories(owner);
  const catalog = buildProjectCatalog({ owner, repositories, existing });
  const cards = renderProjectCards(catalog.projects);
  const page = fs.readFileSync(pagePath, "utf8");

  fs.writeFileSync(catalogPath, yaml.dump(catalog, { lineWidth: 120, noRefs: true }));
  fs.writeFileSync(pagePath, replaceProjectSection(page, cards));

  console.log(`Synchronized ${catalog.projects.length} showcase project(s) for ${owner}.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
