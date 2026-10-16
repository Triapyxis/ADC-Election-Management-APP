export const ALLOWED: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
export const MAX_BYTES = 10 * 1024 * 1024, MAX_DOCS = 5;
export const BUCKET = "result-sheets";

export function validateUpload(i: { contentType?: string; size?: number }): string[] {
  const o: string[] = [];
  if (!i.contentType || !(i.contentType in ALLOWED)) o.push("Only JPEG, PNG, WebP or PDF files are accepted.");
  if (!Number.isInteger(i.size) || (i.size ?? 0) <= 0) o.push("The file is empty.");
  else if ((i.size ?? 0) > MAX_BYTES) o.push("The file is larger than 10 MB.");
  return o;
}
/** Server-chosen file name: client-supplied names never reach storage unsanitised. */
export function safeName(filename: string, contentType: string): string {
  const base = (filename.split(/[\\/]/).pop() ?? "").replace(/\.[^.]*$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "sheet";
  return `${base}.${ALLOWED[contentType] ?? "bin"}`;
}
/** A path is acceptable only if it is directly inside <uid>/<submission>/ with no traversal. */
export function isOwnPath(path: string, uid: string, submissionId: string): boolean {
  const prefix = `${uid}/${submissionId}/`;
  return path.startsWith(prefix) && !path.includes("..") && !path.slice(prefix.length).includes("/") && path.length > prefix.length;
}
