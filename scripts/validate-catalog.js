#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CONCEPT_ROLES = new Set(["introduces", "explains", "applies"]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function addError(errors, location, message) {
  errors.push(`${location}: ${message}`);
}

function validateUniqueIds(items, label, errors) {
  if (!Array.isArray(items)) {
    addError(errors, label, "must be an array");
    return new Map();
  }

  const byId = new Map();
  items.forEach((item, index) => {
    const location = `${label}[${index}]`;
    if (!isRecord(item)) {
      addError(errors, location, "must be an object");
      return;
    }
    if (typeof item.id !== "string" || !ID_PATTERN.test(item.id)) {
      addError(errors, `${location}.id`, "must be a lowercase, hyphen-separated stable ID");
      return;
    }
    if (byId.has(item.id)) {
      addError(errors, `${location}.id`, `duplicates ${label} ID "${item.id}"`);
      return;
    }
    byId.set(item.id, item);
  });
  return byId;
}

function validateBookPath(contentPath, bookRoot, projectRoot, location, errors) {
  if (typeof contentPath !== "string" || contentPath.length === 0) {
    addError(errors, `${location}.contentPath`, "must be a relative path under book/");
    return;
  }

  const normalized = path.posix.normalize(contentPath);
  if (
    contentPath.includes("\\") ||
    path.posix.isAbsolute(contentPath) ||
    normalized !== contentPath ||
    normalized === "." ||
    normalized.split("/").includes("..") ||
    !normalized.startsWith("book/") ||
    path.posix.extname(normalized).toLowerCase() !== ".html"
  ) {
    addError(errors, `${location}.contentPath`, "must be a normalized .html path under book/ without traversal");
    return;
  }

  const resolved = path.resolve(projectRoot, ...normalized.split("/"));
  const relativeToBooks = path.relative(bookRoot, resolved);
  if (relativeToBooks.startsWith("..") || path.isAbsolute(relativeToBooks)) {
    addError(errors, `${location}.contentPath`, "resolves outside book/");
    return;
  }

  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    addError(errors, `${location}.contentPath`, `does not resolve to an existing file: ${normalized}`);
    return;
  }

  const realBookRoot = fs.realpathSync(bookRoot);
  const realFilePath = fs.realpathSync(resolved);
  const realRelative = path.relative(realBookRoot, realFilePath);
  if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
    addError(errors, `${location}.contentPath`, "resolves through a symlink outside book/");
  }
}

function validateCatalog(catalog, projectRoot = path.resolve(__dirname, "..")) {
  const errors = [];
  if (!isRecord(catalog)) {
    return ["catalog: must be an object"];
  }
  if (catalog.schemaVersion !== 1) {
    addError(errors, "schemaVersion", "must be 1");
  }

  const books = validateUniqueIds(catalog.books, "books", errors);
  const taxonomy = validateUniqueIds(catalog.taxonomy, "taxonomy", errors);
  const concepts = validateUniqueIds(catalog.concepts, "concepts", errors);
  const relations = validateUniqueIds(catalog.conceptRelations, "conceptRelations", errors);
  const learningPaths = validateUniqueIds(catalog.learningPaths, "learningPaths", errors);
  const bookRoot = path.resolve(projectRoot, "book");

  for (const [id, book] of books) {
    const location = `books.${id}`;
    for (const field of ["title", "summary"]) {
      if (typeof book[field] !== "string" || book[field].trim() === "") {
        addError(errors, `${location}.${field}`, "must be a non-empty string");
      }
    }
    validateBookPath(book.contentPath, bookRoot, projectRoot, location, errors);
    if (!Number.isInteger(book.revision) || book.revision < 1) {
      addError(errors, `${location}.revision`, "must be a positive integer");
    }
    if (book.status !== "published") {
      addError(errors, `${location}.status`, 'must be "published" for a static catalog entry');
    }
    if (!Number.isInteger(book.readingMinutes) || book.readingMinutes < 1) {
      addError(errors, `${location}.readingMinutes`, "must be a positive integer");
    }

    if (!Array.isArray(book.taxonomyIds) || book.taxonomyIds.length === 0) {
      addError(errors, `${location}.taxonomyIds`, "must contain at least one taxonomy ID");
    } else {
      const assigned = new Set();
      for (const taxonomyId of book.taxonomyIds) {
        if (!taxonomy.has(taxonomyId)) {
          addError(errors, `${location}.taxonomyIds`, `references unknown taxonomy ID "${taxonomyId}"`);
        }
        if (assigned.has(taxonomyId)) {
          addError(errors, `${location}.taxonomyIds`, `contains duplicate taxonomy ID "${taxonomyId}"`);
        }
        assigned.add(taxonomyId);
      }
      if (!assigned.has(book.primaryTaxonomyId)) {
        addError(errors, `${location}.primaryTaxonomyId`, "must also appear in taxonomyIds");
      }
    }

    if (!Array.isArray(book.tags) || book.tags.some(tag => typeof tag !== "string" || tag.trim() === "")) {
      addError(errors, `${location}.tags`, "must be an array of non-empty strings");
    }
    if (!Array.isArray(book.conceptLinks)) {
      addError(errors, `${location}.conceptLinks`, "must be an array");
    } else {
      book.conceptLinks.forEach((link, index) => {
        const linkLocation = `${location}.conceptLinks[${index}]`;
        if (!isRecord(link)) {
          addError(errors, linkLocation, "must be an object");
          return;
        }
        if (!concepts.has(link.conceptId)) {
          addError(errors, `${linkLocation}.conceptId`, `references unknown concept "${link.conceptId}"`);
        }
        if (!CONCEPT_ROLES.has(link.role)) {
          addError(errors, `${linkLocation}.role`, "must be introduces, explains, or applies");
        }
      });
    }
  }

  const siblingOrders = new Map();
  for (const [id, node] of taxonomy) {
    const location = `taxonomy.${id}`;
    if (typeof node.name !== "string" || node.name.trim() === "") {
      addError(errors, `${location}.name`, "must be a non-empty string");
    }
    if (!Number.isInteger(node.order) || node.order < 1) {
      addError(errors, `${location}.order`, "must be a positive integer");
    }
    if (node.parentId !== null && !taxonomy.has(node.parentId)) {
      addError(errors, `${location}.parentId`, `references unknown taxonomy "${node.parentId}"`);
    }
    const siblingKey = node.parentId === null ? "<root>" : node.parentId;
    if (!siblingOrders.has(siblingKey)) {
      siblingOrders.set(siblingKey, new Set());
    }
    if (siblingOrders.get(siblingKey).has(node.order)) {
      addError(errors, `${location}.order`, "must be unique among siblings");
    } else {
      siblingOrders.get(siblingKey).add(node.order);
    }

    const visited = new Set([id]);
    let parentId = node.parentId;
    while (parentId !== null && taxonomy.has(parentId)) {
      if (visited.has(parentId)) {
        addError(errors, location, "has a parent cycle");
        break;
      }
      visited.add(parentId);
      parentId = taxonomy.get(parentId).parentId;
    }
  }

  for (const [id, concept] of concepts) {
    if (typeof concept.name !== "string" || concept.name.trim() === "") {
      addError(errors, `concepts.${id}.name`, "must be a non-empty string");
    }
    if (typeof concept.description !== "string" || concept.description.trim() === "") {
      addError(errors, `concepts.${id}.description`, "must be a non-empty string");
    }
  }

  for (const [id, relation] of relations) {
    const location = `conceptRelations.${id}`;
    if (!concepts.has(relation.fromConceptId)) {
      addError(errors, `${location}.fromConceptId`, `references unknown concept "${relation.fromConceptId}"`);
    }
    if (!concepts.has(relation.toConceptId)) {
      addError(errors, `${location}.toConceptId`, `references unknown concept "${relation.toConceptId}"`);
    }
    if (typeof relation.type !== "string" || relation.type.trim() === "") {
      addError(errors, `${location}.type`, "must be a non-empty relationship label");
    }
  }

  for (const [id, learningPath] of learningPaths) {
    const location = `learningPaths.${id}`;
    for (const field of ["title", "description"]) {
      if (typeof learningPath[field] !== "string" || learningPath[field].trim() === "") {
        addError(errors, `${location}.${field}`, "must be a non-empty string");
      }
    }
    if (!Array.isArray(learningPath.items) || learningPath.items.length === 0) {
      addError(errors, `${location}.items`, "must contain at least one ordered book");
      continue;
    }
    const seenBooks = new Set();
    learningPath.items.forEach((item, index) => {
      const itemLocation = `${location}.items[${index}]`;
      if (!isRecord(item)) {
        addError(errors, itemLocation, "must be an object");
        return;
      }
      if (item.position !== index + 1) {
        addError(errors, `${itemLocation}.position`, `must be contiguous and equal ${index + 1}`);
      }
      if (!books.has(item.bookId)) {
        addError(errors, `${itemLocation}.bookId`, `references unknown book "${item.bookId}"`);
      }
      if (seenBooks.has(item.bookId)) {
        addError(errors, `${itemLocation}.bookId`, `duplicates book "${item.bookId}" in this path`);
      }
      seenBooks.add(item.bookId);
      if (typeof item.required !== "boolean") {
        addError(errors, `${itemLocation}.required`, "must be a boolean");
      }
      if (!Number.isInteger(item.estimatedMinutes) || item.estimatedMinutes < 1) {
        addError(errors, `${itemLocation}.estimatedMinutes`, "must be a positive integer");
      }
    });
  }

  return errors;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length > 2 || (args.length > 0 && args[0] !== "--catalog")) {
    console.error("Usage: node scripts/validate-catalog.js [--catalog <path>]");
    process.exitCode = 2;
    return;
  }
  const catalogPath = args.length === 2
    ? path.resolve(process.cwd(), args[1])
    : path.resolve(__dirname, "..", "data", "catalog.json");

  let catalog;
  try {
    catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  } catch (error) {
    console.error(`Cannot read valid JSON from ${catalogPath}: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const errors = validateCatalog(catalog, path.resolve(__dirname, ".."));
  if (errors.length > 0) {
    console.error(`Catalog validation failed with ${errors.length} error(s):`);
    errors.forEach(error => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }

  console.log(`Catalog valid: ${catalog.books.length} books, ${catalog.taxonomy.length} topics, ${catalog.concepts.length} concepts, ${catalog.learningPaths.length} learning paths.`);
}

if (require.main === module) {
  main();
}

module.exports = { validateCatalog };
