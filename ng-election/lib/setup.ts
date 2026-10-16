import { CONTEST_TYPES } from "./seats.ts";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const https = (u: unknown) => typeof u === "string" && /^https:\/\/[^\s]+$/.test(u);
const blank = (v: unknown) => v === undefined || v === null || v === "";
export type Kind = "election" | "party" | "contest" | "candidate";

export function validateSetup(kind: Kind, i: Record<string, any>): string[] {
  const o: string[] = [];
  if (kind === "election") {
    if (!i.name?.trim()) o.push("Election name is required.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(i.electionDate ?? "") || Number.isNaN(Date.parse(i.electionDate))) o.push("Election date must be a valid YYYY-MM-DD date.");
    if (!["upcoming", "live", "concluded"].includes(i.status)) o.push("Status must be upcoming, live or concluded.");
  } else if (kind === "party") {
    if (!/^[A-Z0-9-]{2,10}$/.test(i.abbreviation ?? "")) o.push("Abbreviation must be 2 to 10 capital letters, digits or hyphens.");
    if (!i.name?.trim()) o.push("Party name is required.");
    if (!blank(i.brandColour) && !/^#[0-9a-fA-F]{6}$/.test(i.brandColour)) o.push("Brand colour must look like #1f6f8b.");
    if (!blank(i.logoUrl) && !https(i.logoUrl)) o.push("Logo URL must start with https://");
  } else if (kind === "contest") {
    if (!UUID.test(i.electionId ?? "")) o.push("Choose an election.");
    if (!(CONTEST_TYPES as readonly string[]).includes(i.type)) o.push("Choose a contest type.");
    if (!i.name?.trim()) o.push("Contest name is required.");
    const scopes = ["stateId", "senatorialDistrictId", "federalConstituencyId"].filter((k) => !blank(i[k]));
    if (scopes.length > 1) o.push("Set only one area for a contest.");
    if (scopes.some((k) => !UUID.test(i[k]))) o.push("Area id is not valid.");
  } else if (kind === "candidate") {
    if (!UUID.test(i.contestId ?? "") || !UUID.test(i.partyId ?? "")) o.push("Choose a contest and a party.");
    if (!i.fullName?.trim()) o.push("Candidate name is required.");
    if (!blank(i.photoUrl) && !https(i.photoUrl)) o.push("Photo URL must start with https://");
  } else o.push("Unknown setup type.");
  return o;
}
export function validateDeclaration(i: { contestId?: string; candidateId?: string; sourceReference?: string }): string[] {
  const o: string[] = [];
  if (!UUID.test(i.contestId ?? "") || !UUID.test(i.candidateId ?? "")) o.push("Choose a contest and a candidate.");
  if ((i.sourceReference ?? "").trim().length < 10) o.push("An official source reference of at least 10 characters is required (for example the INEC notice or form number).");
  return o;
}
