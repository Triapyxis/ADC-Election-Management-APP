import {
  getPresidentialSnapshot,
  type Candidate,
} from "@/lib/results";
import { MapView } from "@/components/MapView";
import { db } from "@/lib/supabase/server";
import { presidentialContest } from "@/lib/drilldown";
import {
  MODES,
  MODE_CONTEST,
  shade,
  leadingByState,
  type Mode,
} from "@/lib/map-modes";
import { VoterServices } from "@/components/VoterServices";

export const dynamic = "force-dynamic";

const n = (v: number) => v.toLocaleString("en-NG");

const initials = (s: string) =>
  s.split(/\s+/).map((w) => w[0]).slice(0, 2).join("");

function Face({ c }: { c: Candidate }) {
  return c.photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={c.photo}
      alt={c.name}
      className="h-16 w-16 shrink-0 rounded-xl object-cover"
    />
  ) : (
    <div
      aria-hidden
      className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-brand-mint text-lg font-bold text-brand-forest"
    >
      {initials(c.name)}
    </div>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode: requestedMode } = await searchParams;

  const mode: Mode = (MODES as readonly string[]).includes(requestedMode ?? "")
    ? (requestedMode as Mode)
    : "presidential";

  // Results are optional: the map and civic information must still render.
  let snap: Awaited<ReturnType<typeof getPresidentialSnapshot>> | null = null;
  let resultsUnavailable = false;

  try {
    snap = await getPresidentialSnapshot();
  } catch {
    resultsUnavailable = true;
  }

  const cs = snap?.candidates ?? [];
  const p = snap?.progress;
  const [a, b] = cs;

  const reported = a?.votes != null;
  const pct = p?.expected ? (p.reporting / p.expected) * 100 : 0;

  // Build the presidential map from verified state leaders.
  const presidentialFills: Record<string, string> = {};

  if (snap) {
    for (const [key, leader] of Object.entries(snap.stateLeaders)) {
      const candidate = cs.find((item) => item.id === leader.candidateId);
      if (candidate?.colour) presidentialFills[key] = candidate.colour;
    }
  }

  const presidentialLegend = snap
    ? cs.filter(
        (candidate) =>
          candidate.colour &&
          Object.values(snap.stateLeaders).some(
            (leader) => leader.candidateId === candidate.id
          )
      )
    : [];

  const fillsByMode: Record<string, Record<string, string>> = {
    presidential: presidentialFills,
  };

  const notesByMode: Record<string, string> = {
    presidential: presidentialLegend.length
      ? "Colour shows the party currently leading in each state, not a declared winner."
