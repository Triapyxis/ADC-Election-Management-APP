export type SubmissionInput = {
  contestId: string; pollingUnitId: string; idempotencyKey: string;
  votes: { candidateId: string; votes: number }[];
  accredited?: number; rejectedBallots?: number; deviceTime?: string;
};
export type Issue = { field: string; message: string };
const isCount = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 1_000_000;

/** Server-side validation. Missing candidates are errors: an explicit 0 is required, so "zero" and "not entered" never blur. */
export function validateSubmission(i: SubmissionInput, contestCandidateIds: string[]): Issue[] {
  const out: Issue[] = []; const add = (field: string, message: string) => out.push({ field, message });
  if (!i.contestId || !i.pollingUnitId) add("ids", "Contest and polling unit are required.");
  if (!i.idempotencyKey || i.idempotencyKey.length > 128) add("idempotencyKey", "A key of 1 to 128 characters is required.");
  if (!Array.isArray(i.votes) || i.votes.length === 0) { add("votes", "Enter votes for every candidate."); return out; }
  const seen = new Set<string>(), allowed = new Set(contestCandidateIds);
  for (const v of i.votes) {
    if (!allowed.has(v.candidateId)) add("votes", `Candidate ${v.candidateId} is not in this contest.`);
    if (seen.has(v.candidateId)) add("votes", `Candidate ${v.candidateId} appears more than once.`);
    seen.add(v.candidateId);
    if (!isCount(v.votes)) add("votes", "Votes must be whole numbers from 0 to 1,000,000.");
  }
  for (const id of contestCandidateIds) if (!seen.has(id)) add("votes", `Missing votes for candidate ${id}. Enter 0 if none.`);
  if (i.accredited !== undefined && !isCount(i.accredited)) add("accredited", "Accredited voters must be a whole number.");
  if (i.rejectedBallots !== undefined && !isCount(i.rejectedBallots)) add("rejectedBallots", "Rejected ballots must be a whole number.");
  if (i.deviceTime !== undefined && Number.isNaN(Date.parse(i.deviceTime))) add("deviceTime", "Device time is not a valid timestamp.");
  if (!out.length && i.accredited !== undefined) {
    const total = i.votes.reduce((a, v) => a + v.votes, 0) + (i.rejectedBallots ?? 0);
    if (total > i.accredited) add("votes", `Valid plus rejected (${total}) exceeds accredited voters (${i.accredited}).`);
  }
  return out;
}
