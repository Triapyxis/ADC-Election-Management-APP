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
      : resultsUnavailable
        ? "Results are temporarily unavailable. The map remains visible; states retain their neutral colour until verified results can be displayed."
        : "No verified state leaders are available yet. States retain their neutral colour until verified results arrive.",
  };

  const legendsByMode: Record<
    string,
    { label: string; colour: string }[]
  > = {
    presidential: presidentialLegend.map((candidate) => ({
      label: candidate.party,
      colour: candidate.colour!,
    })),
  };

  // Initialise the server-side database client once for all map queries.
  let supabase: ReturnType<typeof db> | null = null;
  let stateNames = new Map<string, string>();
  let stateLookupFailed = false;

  try {
    supabase = db();
    const { data: states, error } = await supabase
      .from("states")
      .select("id,name");

    if (error) throw error;

    stateNames = new Map(
      (states ?? []).map((state: any) => [
        state.id,
        String(state.name).toLowerCase(),
      ])
    );
  } catch {
    stateLookupFailed = true;
  }

  // Load the reporting contest once, then reuse it for the reporting map.
  let reportingContext: Awaited<ReturnType<typeof presidentialContest>> = null;

  try {
    reportingContext = await presidentialContest();
  } catch {
    reportingContext = null;
  }

  for (const mapMode of MODES) {
    if (mapMode === "presidential") continue;

    const mapFills: Record<string, string> = {};
    let mapLegend: { label: string; colour: string }[] = [];
    let mapNote =
      "This map information could not be loaded right now. The Nigeria map remains visible, with neutral state colours.";

    try {
      if (!supabase || stateLookupFailed) {
        throw new Error("State information is unavailable");
      }

      if (mapMode === "reporting") {
        const { data, error } = reportingContext
          ? await supabase
              .from("public_state_progress")
              .select("state_id,expected_units,reporting_units")
              .eq("contest_id", reportingContext.contestId)
          : { data: [], error: null };

        if (error) throw error;

        for (const row of (data ?? []) as any[]) {
          const key = stateNames.get(row.state_id);

          if (key) {
            mapFills[key] = shade(
              Number(row.reporting_units),
              Number(row.expected_units)
            );
          }
        }

        mapNote = reportingContext
          ? "Darker shades indicate a larger share of polling units with verified results. States without verified results remain neutral. This shows reporting coverage, not who is ahead."
          : "Reporting information is not available yet. The map remains visible until an election is published.";
      } else {
        const { data, error } = await supabase
          .from("public_contest_leaders")
          .select("state_id,party,brand_colour,margin")
          .eq("type", MODE_CONTEST[mapMode])
          .limit(5000);

        if (error) throw error;

        const leaders = leadingByState(
          ((data ?? []) as any[])
            .filter((row) => row.state_id)
            .map((row) => ({
              stateKey: stateNames.get(row.state_id) ?? "",
              party: row.party,
              colour: row.brand_colour,
              margin: Number(row.margin),
            }))
        );

        const seen = new Map<string, string>();

        for (const [key, leader] of Object.entries(leaders)) {
          if (leader.colour) {
            mapFills[key] = leader.colour;
            seen.set(leader.party, leader.colour);
          }
        }

        mapLegend = [...seen].map(([label, colour]) => ({
          label,
          colour,
        }));

        mapNote =
          "Colour shows the party leading in the most contests of this type in each state. Ties stay neutral. Leading is not winning.";
      }
    } catch {
      // Keep this mode neutral if its own data cannot be loaded.
      mapNote =
        "This map information could not be loaded right now. The Nigeria map remains visible, with neutral state colours.";
    }

    fillsByMode[mapMode] = mapFills;
    notesByMode[mapMode] = mapNote;
    legendsByMode[mapMode] = mapLegend;
  }

  return (
    <div className="space-y-8">
      {/* ELECTION READINESS: COUNTDOWN + VOTER SERVICES */}
      <VoterServices />

      {/* RESULTS AND MAP */}
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.1fr]">
        {/* NATIONAL RESULTS */}
        <section
          aria-labelledby="h"
          className="rounded-2xl border border-rule bg-white p-5 shadow-card sm:p-7"
        >
          {snap ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium text-ink-soft">
                  {new Date(snap.election.date).toLocaleDateString("en-NG", {
                    dateStyle: "long",
                  })}
                </p>

                <span className="inline-flex items-center gap-2 rounded-full border border-brand-mint bg-brand-mint/50 px-3 py-1.5 text-xs font-semibold text-brand-primary">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      snap.election.status === "live"
                        ? "animate-pulse bg-brand-action"
                        : "bg-brand-sage"
                    }`}
                  />
                  {snap.election.status === "live"
                    ? "Voting and collation under way"
                    : snap.election.status}
                </span>
              </div>

              <h1
                id="h"
                className="mt-4 text-2xl font-bold leading-tight tracking-tight text-brand-forest sm:text-3xl"
              >
                {snap.election.name}
              </h1>

              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                Verified results only. Provisional until officially declared by INEC.
              </p>

              {!reported ? (
                <div className="mt-8 rounded-xl border border-rule bg-paper p-5">
                  <p className="font-medium text-brand-forest">
                    Awaiting results
                  </p>
                  <p className="mt-1 text-sm text-ink-soft">
                    No verified polling-unit results have been recorded yet.
                  </p>
                </div>
              ) : (
                <ol className="mt-8 divide-y divide-rule border-y border-rule">
                  {cs.map((candidate, index) => (
                    <li
                      key={candidate.id}
                      className={`flex items-center gap-4 py-4 ${
                        index > 1 ? "opacity-90" : ""
                      }`}
                    >
                      <Face c={candidate} />

                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate text-brand-forest ${
                            index < 2
                              ? "text-base font-bold sm:text-lg"
                              : "font-semibold"
                          }`}
                        >
                          {candidate.name}
                        </p>

                        <p className="mt-0.5 text-sm text-ink-soft">
                          {candidate.party}
                          {candidate.partyName ? `, ${candidate.partyName}` : ""}
                        </p>

                        <div
                          className="mt-3 h-2 overflow-hidden rounded-full bg-brand-mint"
                          role="img"
                          aria-label={`${candidate.name} ${
                            snap.totalVotes
                              ? (
                                  ((candidate.votes ?? 0) / snap.totalVotes) *
                                  100
                                ).toFixed(1)
                              : 0
                          } percent of votes counted`}
                        >
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${
                                snap.totalVotes
                                  ? ((candidate.votes ?? 0) / snap.totalVotes) *
                                    100
                                  : 0
                              }%`,
                              background: candidate.colour ?? "#235347",
                            }}
                          />
                        </div>
                      </div>

                      <div className="text-right tabular-nums">
                        <p className="font-bold text-brand-forest">
                          {candidate.votes == null
                            ? "No data"
                            : n(candidate.votes)}
                        </p>

                        <p className="text-sm text-ink-soft">
                          {candidate.votes != null && snap.totalVotes
                            ? `${(
                                (candidate.votes / snap.totalVotes) *
                                100
                              ).toFixed(1)}%`
                            : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}

              {reported && b?.votes != null && (
                <p className="mt-4 rounded-lg bg-brand-mint/50 px-4 py-3 text-sm text-brand-primary">
                  <span className="font-semibold">{a!.name}</span> leads by{" "}
                  <span className="font-bold tabular-nums">
                    {n(a!.votes! - b.votes)}
                  </span>{" "}
                  votes. Share is of votes verified so far, not of all votes cast.
                </p>
              )}

              {/* REPORTING STATISTICS */}
              <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-rule bg-paper p-4 transition hover:shadow-card">
                  <dt className="text-xs font-medium leading-relaxed text-ink-soft">
                    Polling units reporting
                  </dt>
                  <dd className="mt-2 text-xl font-bold tracking-tight text-brand-forest tabular-nums">
                    {n(snap.progress.reporting)}
                  </dd>
                  <p className="mt-1 text-xs text-ink-faint">
                    of {n(snap.progress.expected)} expected
                  </p>
                </div>

                <div className="rounded-xl border border-rule bg-paper p-4 transition hover:shadow-card">
                  <dt className="text-xs font-medium text-ink-soft">
                    Reporting
                  </dt>
                  <dd className="mt-2 text-xl font-bold tracking-tight text-brand-action tabular-nums">
                    {pct.toFixed(1)}%
                  </dd>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-brand-mint">
                    <div
                      className="h-full rounded-full bg-brand-action"
                      style={{
                        width: `${Math.min(100, Math.max(0, pct))}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-rule bg-paper p-4 transition hover:shadow-card">
                  <dt className="text-xs font-medium leading-relaxed text-ink-soft">
                    Awaiting verification
                  </dt>
                  <dd className="mt-2 text-xl font-bold tracking-tight text-status-provisional tabular-nums">
                    {n(snap.progress.pending)}
                  </dd>
                  <p className="mt-1 text-xs text-ink-faint">
                    Pending review
                  </p>
                </div>

                <div className="rounded-xl border border-rule bg-paper p-4 transition hover:shadow-card">
                  <dt className="text-xs font-medium text-ink-soft">
                    Rejected
                  </dt>
                  <dd className="mt-2 text-xl font-bold tracking-tight text-status-disputed tabular-nums">
                    {n(snap.progress.rejected)}
                  </dd>
                  <p className="mt-1 text-xs text-ink-faint">
                    Not accepted
                  </p>
                </div>
              </dl>

              <p className="mt-6 border-t border-rule pt-4 text-xs leading-relaxed text-ink-faint">
                Synced {new Date(snap.fetchedAt).toLocaleTimeString("en-NG")}
                {" · "}
                {snap.latestSubmissionAt
                  ? `latest verified result ${new Date(
                      snap.latestSubmissionAt
                    ).toLocaleTimeString("en-NG")}`
                  : "no verified results yet"}
              </p>
            </>
          ) : (
            <div className="py-3">
              <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-brand-mint text-xl font-bold text-brand-forest">
                {resultsUnavailable ? "!" : "N"}
              </div>

              <h1
                id="h"
                className="text-2xl font-bold tracking-tight text-brand-forest"
              >
                {resultsUnavailable
                  ? "Results are temporarily unavailable"
                  : "No election is live"}
              </h1>

              <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-soft">
                {resultsUnavailable
                  ? "The results service did not respond. Nothing shown here has been lost. Please try again later."
                  : "Awaiting results. When an election is published, national totals, reporting progress and verified state results will appear here."}
              </p>

              <div className="mt-6 rounded-xl border border-rule bg-paper p-5">
                <p className="font-semibold text-brand-forest">
                  Nigeria election information
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                  Explore the state map, check official voter services and
                  follow the election countdown while awaiting published results.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* INTERACTIVE STATE MAP: SWITCHES WITHOUT PAGE NAVIGATION */}
        <MapView
          initialMode={mode}
          fillsByMode={fillsByMode}
          notesByMode={notesByMode}
          legendsByMode={legendsByMode}
        />
      </div>
    </div>
  );
}
