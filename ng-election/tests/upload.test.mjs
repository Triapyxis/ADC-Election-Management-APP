import test from "node:test"; import assert from "node:assert/strict";
import { validateUpload, safeName, isOwnPath, MAX_BYTES } from "../lib/upload.ts";
test("allowed types and sizes", () => {
  assert.deepEqual(validateUpload({ contentType: "image/jpeg", size: 1000 }), []);
  assert.deepEqual(validateUpload({ contentType: "application/pdf", size: MAX_BYTES }), []);
  assert.ok(validateUpload({ contentType: "application/pdf", size: MAX_BYTES + 1 }).length);
});
test("executables, html, svg, empty files rejected", () => {
  for (const t of ["application/x-msdownload", "text/html", "image/svg+xml", "application/zip", undefined]) assert.ok(validateUpload({ contentType: t, size: 10 }).length, String(t));
  assert.ok(validateUpload({ contentType: "image/png", size: 0 }).length); assert.ok(validateUpload({ contentType: "image/png", size: 1.5 }).length);
});
test("safeName strips paths, symbols and the claimed extension; type decides extension", () => {
  assert.equal(safeName("../../etc/passwd.png", "image/jpeg"), "passwd.jpg");
  assert.equal(safeName("C:\\Users\\Me\\Result Sheet (1).PDF", "application/pdf"), "result-sheet-1.pdf");
  assert.equal(safeName("***.exe", "image/png"), "sheet.png");
  assert.ok(safeName("a".repeat(300) + ".jpg", "image/jpeg").length <= 44);
});
test("isOwnPath: own folder only, no traversal, no nesting", () => {
  const U = "u1", S = "s1";
  assert.ok(isOwnPath("u1/s1/abc-sheet.jpg", U, S));
  for (const p of ["u2/s1/x.jpg", "u1/s2/x.jpg", "u1/s1/../u2/x.jpg", "u1/s1/a/b.jpg", "u1/s1/"]) assert.ok(!isOwnPath(p, U, S), p);
});
