import { getPresidentialSnapshot, type Candidate } from "@/lib/results";
import { NigeriaMap } from "@/components/NigeriaMap";
import Link from "next/link";
import { db } from "@/lib/supabase/server";
import { presidentialContest } from "@/lib/drilldown";
import { MODES, MODE_LABEL, MODE_CONTEST, shade, leadingByState, type Mode } from "@/lib/map-modes";

export const dynamic = "force-dynamic"; // live results must never be served from a stale cache

const n = (v: number) => v.toLocaleString("en-NG");
const initials = (s: string) => s.split(/\s+/).map((w) => w[0]).slice(0, 2).join("");

function Face({ c }: { c: Candidate }) {
  return c.photo
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={c.photo} alt={c.name} className="h-16 w-16 shrink-0 rounded-sm object-cover" />
    : <div aria-hidden className="grid h-16 w-16 shrink-0 place-items-center rounded-sm bg-rule text-lg font-semibold text-ink-soft">{initials(c.name)}</div>;
}

export default async function Home({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode: m } = await searchParams; const mode: Mode = (MODES as readonly string[]).includes(m ?? "") ? (m as Mode) : "presidential";
  let snap; 
  try { snap = await getPresidentialSnapshot(); }
  catch { return (<section><h1 className="text-2xl font-semibold">Results are temporarily unavailable</h1>
    <p className="mt-2 max-w-prose text-ink-soft">The results service did not respond. Nothing shown here has been lost; reload in a minute.</p></section>); }

  if (!snap) return (<section><h1 className="text-2xl font-semibold">No election is live</h1>
    <p className="mt-2 max-w-prose text-ink-soft">Awaiting results. When an election is published, national totals, reporting progress and the state map appear here.</p></section>);

  const { candidates: cs, progress: p } = snap;
  const [a, b] = cs; const reported = a?.votes != null;
  const pct = p.expected ? (p.reporting / p.expected) * 100 : 0;
  const fills: Record<string, string> = {};
  for (const [k, l] of Object.entries(snap.stateLeaders)) { const c = cs.find((x) => x.id === l.candidateId); if (c?.colour) fills[k] = c.colour; }
  const legend = cs.filter((c) => c.colour && Object.values(snap.stateLeaders).some((l) => l.candidateId === c.id));

  // Map mode data. Failures here fall back to a grey map with an honest note; the rest of the page still renders.
  let mapFills: Record<string, string> = fills, modeNote = legend.length ? "Colour shows the party currently leading in each state, not a declared winner. " : "States stay grey until verified results arrive. ", modeLegend: { label: string; colour: string }[] = legend.map((c) => ({ label: c.party, colour: c.colour! }));
  if (mode !== "presidential") {
    mapFills = {}; modeLegend = [];
    try {
      const sb = db(); const { data: st } = await sb.from("states").select("id,name"); const name = new Map((st ?? []).map((x: any) => [x.id, String(x.name).toLowerCase()]));
      if (mode === "reporting") {
        const ctx = await presidentialContest();
        const { data } = ctx ? await sb.from("public_state_progress").select("state_id,expected_units,reporting_units").eq("contest_id", ctx.contestId) : { data: [] };
        for (const r of (data ?? []) as any[]) { const k = name.get(r.state_id); if (k) mapFills[k] = shade(Number(r.reporting_units), Number(r.expected_units)); }
        modeNote = "Darker means a larger share of polling units has verified results. Grey means none yet. This shows reporting coverage, not who is ahead. ";
      } else {
        const { data } = await sb.from("public_contest_leaders").select("state_id,party,brand_colour,margin").eq("type", MODE_CONTEST[mode]).limit(5000);
        const lead = leadingByState(((data ?? []) as any[]).filter((r) => r.state_id).map((r) => ({ stateKey: name.get(r.state_id) ?? "", party: r.party, colour: r.brand_colour, margin: Number(r.margin) })));
        const seen = new Map<string, string>();
        for (const [k, v] of Object.entries(lead)) { if (v.colour) { mapFills[k] = v.colour; seen.set(v.party, v.colour); } }
        modeLegend = [...seen].map(([label, colour]) => ({ label, colour }));
        modeNote = "Colour shows the party leading in the most contests of this type in each state. Ties stay grey. Leading is not winning. ";
      }
    } catch { modeNote = "This map view could not be loaded right now. "; }
  }
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.1fr]">
      <section aria-labelledby="h">
        <p className="text-sm text-ink-soft">{new Date(snap.election.date).toLocaleDateString("en-NG", { dateStyle: "long" })} · {snap.election.status === "live" ? "Voting and collation under way" : snap.election.status}</p>
        <h1 id="h" className="mt-1 text-3xl font-semibold leading-tight">{snap.election.name}</h1>
        <p className="mt-1 text-ink-soft">Verified results only. Provisional until officially declared by INEC.</p>

        {!reported ? <p className="mt-8 text-lg">Awaiting results. No verified polling-unit results have been recorded yet.</p> : (
          <ol className="mt-8 divide-y divide-rule border-y border-rule">
            {cs.map((c, i) => (
              <li key={c.id} className={`flex items-center gap-4 py-4 ${i > 1 ? "opacity-90" : ""}`}>
                <Face c={c} />
                <div className="min-w-0 flex-1">
                  <p className={`truncate ${i < 2 ? "text-lg font-semibold" : "font-medium"}`}>{c.name}</p>
                  <p className="text-sm text-ink-soft">{c.party}{c.partyName ? `, ${c.partyName}` : ""}</p>
                  <div className="mt-2 h-1.5 bg-rule" role="img" aria-label={`${c.name} ${snap.totalVotes ? ((c.votes ?? 0) / snap.totalVotes * 100).toFixed(1) : 0} percent of votes counted`}>
                    <div className="h-full" style={{ width: `${snap.totalVotes ? ((c.votes ?? 0) / snap.totalVotes) * 100 : 0}%`, background: c.colour ?? "#0b6b3a" }} />
                  </div>
                </div>
                <div className="text-right tabular-nums"><p className="font-semibold">{c.votes == null ? "No data" : n(c.votes)}</p>
                  <p className="text-sm text-ink-soft">{c.votes != null && snap.totalVotes ? `${((c.votes / snap.totalVotes) * 100).toFixed(1)}%` : ""}</p></div>
              </li>))}
          </ol>)}
        {reported && b?.votes != null && <p className="mt-3 text-sm text-ink-soft">{a!.name} leads by {n(a!.votes! - b.votes)} votes. Share is of votes verified so far, not of all votes cast.</p>}

        <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          <div><dt className="text-ink-soft">Polling units reporting</dt><dd className="text-lg font-semibold tabular-nums">{n(p.reporting)} of {n(p.expected)}</dd></div>
          <div><dt className="text-ink-soft">Reporting</dt><dd className="text-lg font-semibold tabular-nums">{pct.toFixed(1)}%</dd></div>
          <div><dt className="text-ink-soft">Awaiting verification</dt><dd className="text-lg font-semibold tabular-nums">{n(p.pending)}</dd></div>
          <div><dt className="text-ink-soft">Rejected</dt><dd className="text-lg font-semibold tabular-nums">{n(p.rejected)}</dd></div>
        </dl>
        <p className="mt-6 text-xs text-ink-faint">Synced {new Date(snap.fetchedAt).toLocaleTimeString("en-NG")} · {snap.latestSubmissionAt ? `latest verified result ${new Date(snap.latestSubmissionAt).toLocaleTimeString("en-NG")}` : "no verified results yet"}</p>
      </section>

      <section aria-label="State map">
        <nav aria-label="Map view" className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">{MODES.map((x) => <Link key={x} href={x === "presidential" ? "/" : `/?mode=${x}`} className={x === mode ? "font-semibold underline" : "text-green underline"}>{MODE_LABEL[x]}</Link>)}</nav>
        <NigeriaMap fills={mapFills} />
        <p className="mt-2 text-sm text-ink-soft">{modeNote}Select a state for its results.</p>
        {modeLegend.length > 0 && <ul className="mt-2 flex flex-wrap gap-x-4 text-sm">{modeLegend.map((c) => <li key={c.label} className="flex items-center gap-1.5"><span className="h-3 w-3" style={{ background: c.colour }} />{c.label}</li>)}</ul>}
        <p className="mt-2 text-xs text-ink-faint">Simplified boundaries, Simplemaps (free licence).</p>
      </section>
    </div>
  );
}
