"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { validateCatalog } = require("../scripts/validate-catalog.js");

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "index-dictionary-catalog-"));
  fs.mkdirSync(path.join(root, "book"));
  fs.writeFileSync(path.join(root, "book", "sample.html"), "<!doctype html><title>Sample</title>");
  const catalog = {
    schemaVersion: 1,
    books: [{
      id: "sample-book",
      title: "Sample book",
      summary: "A sample.",
      contentPath: "book/sample.html",
      revision: 1,
      status: "published",
      readingMinutes: 5,
      primaryTaxonomyId: "ideas",
      taxonomyIds: ["ideas"],
      tags: ["Sample"],
      conceptLinks: [{ conceptId: "sample-concept", role: "explains" }]
    }],
    taxonomy: [{ id: "ideas", name: "Ideas", parentId: null, order: 1 }],
    concepts: [{ id: "sample-concept", name: "Sample concept", description: "A sample concept." }],
    conceptRelations: [],
    learningPaths: [{
      id: "sample-path",
      title: "Sample path",
      description: "A sample learning path.",
      items: [{ position: 1, bookId: "sample-book", required: true, estimatedMinutes: 5 }]
    }]
  };
  return { root, catalog };
}

test("accepts a complete catalog with existing book files", t => {
  const { root, catalog } = createFixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.deepEqual(validateCatalog(catalog, root), []);
});

test("rejects duplicate IDs and non-contiguous learning path positions", t => {
  const { root, catalog } = createFixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  catalog.books.push({ ...catalog.books[0] });
  catalog.learningPaths[0].items[0].position = 2;
  const errors = validateCatalog(catalog, root);
  assert.ok(errors.some(error => error.includes('duplicates books ID "sample-book"')));
  assert.ok(errors.some(error => error.includes("must be contiguous and equal 1")));
});

test("rejects unsafe paths, missing files, and unknown metadata references", t => {
  const { root, catalog } = createFixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  catalog.books[0].contentPath = "book/../outside.html";
  catalog.books[0].taxonomyIds = ["missing-topic"];
  catalog.books[0].conceptLinks[0].conceptId = "missing-concept";
  catalog.conceptRelations.push({
    id: "broken-relation",
    fromConceptId: "missing-concept",
    type: "related_to",
    toConceptId: "sample-concept"
  });
  catalog.learningPaths[0].items.push({
    position: 2,
    bookId: "missing-book",
    required: true,
    estimatedMinutes: 5
  });
  const errors = validateCatalog(catalog, root);
  assert.ok(errors.some(error => error.includes("normalized .html path under book/")));
  assert.ok(errors.some(error => error.includes('references unknown taxonomy ID "missing-topic"')));
  assert.ok(errors.some(error => error.includes('references unknown concept "missing-concept"')));
  assert.ok(errors.some(error => error.includes('references unknown book "missing-book"')));
});

test("rejects taxonomy cycles and invalid primary topic assignments", t => {
  const { root, catalog } = createFixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  catalog.taxonomy.push({ id: "subtopic", name: "Subtopic", parentId: "ideas", order: 1 });
  catalog.taxonomy.push({ id: "second-subtopic", name: "Second subtopic", parentId: "ideas", order: 1 });
  catalog.taxonomy[0].parentId = "subtopic";
  catalog.books[0].primaryTaxonomyId = "subtopic";
  const errors = validateCatalog(catalog, root);
  assert.ok(errors.some(error => error.includes("has a parent cycle")));
  assert.ok(errors.some(error => error.includes("must also appear in taxonomyIds")));
  assert.ok(errors.some(error => error.includes("must be unique among siblings")));
});

test("rejects a catalog path whose target file is missing", t => {
  const { root, catalog } = createFixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  catalog.books[0].contentPath = "book/missing.html";
  const errors = validateCatalog(catalog, root);
  assert.ok(errors.some(error => error.includes("does not resolve to an existing file")));
});

test("rejects a book file symlink that escapes the book directory", t => {
  const { root, catalog } = createFixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const outsidePath = path.join(root, "outside.html");
  fs.writeFileSync(outsidePath, "<!doctype html><title>Outside</title>");
  fs.symlinkSync(outsidePath, path.join(root, "book", "linked.html"));
  catalog.books[0].contentPath = "book/linked.html";
  const errors = validateCatalog(catalog, root);
  assert.ok(errors.some(error => error.includes("resolves through a symlink outside book/")));
});
