import { createHash, randomBytes } from "node:crypto";
/** Station key: shown once, stored only as a SHA-256 hash. 256 bits of randomness, so a plain hash is sufficient. */
export const generateKey = () => "sr_" + randomBytes(32).toString("base64url");
export const hashKey = (k: string) => createHash("sha256").update(k).digest("hex");
export function parseBearer(h: string | null | undefined): string | null { const m = /^Bearer\s+(sr_[A-Za-z0-9_-]{43})$/.exec(h ?? ""); return m ? m[1]! : null; }
export const validateLabel = (l?: string): string[] => ((l ?? "").trim().length < 2 || (l ?? "").trim().length > 60 ? ["Give the laptop a name of 2 to 60 characters."] : []);
