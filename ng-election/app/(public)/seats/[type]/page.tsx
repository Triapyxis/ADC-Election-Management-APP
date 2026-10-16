import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase/server";
import { CONTEST_TYPES, TYPE_LABEL, seatsLed, type ContestType } from "@/lib/seats";
export const dynamic = "force-dynamic";

export default async function Seats({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params; if (!(CONTEST_TYPES as readonly string[]).includes(type)) notFound();
  const t = type as ContestType, s = db();
  try {
    const [led, total] = await Promise.all([
      s.from("public_contest_leaders").select("party,brand_colour,margin").eq("type", t).limit(2000),
      s.from("contests").select("id", { count: "exact", head: true }).eq("type", t),
    ]);
    if (led.error || total.error) throw led.error ?? total.error;
    const r = seatsLed((led.data ?? []).map((x: any) => ({ party: x.party, colour: x.brand_colour, margin: Number(x.margin) })));
    const max = Math.max(1, ...r.parties.map((p) => p.seats)), counted = r.parties.reduce((a, p) => a + p.seats, 0) + r.tied;
    return (
      <div><Link href={`/contests?type=${t}`} className="text-sm text-green underline">All {TYPE_LABEL[t]} contests</Link>
        <h1 className="mt-3 text-3xl font-semibold">{TYPE_LABEL[t]}: seats led</h1>
        <p className="mt-1 max-w-prose text-ink-soft">Parties currently leading on verified results. Leading is not winning: no seat is shown as won until officially declared.</p>
        <p className="mt-4 tabular-nums">{counted} of {total.count ?? 0} contests have verified results{r.tied ? `, ${r.tied} tied` : ""}.</p>
        {!r.parties.length ? <p className="mt-6 text-lg">Awaiting results.</p> : (
          <ul className="mt-6 space-y-2">{r.parties.map((p) => <li key={p.party} className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-3 text-sm"><span>{p.party}</span><div className="h-4 bg-rule/60"><div className="h-full" style={{ width: `${(p.seats / max) * 100}%`, background: p.colour ?? "#7b8a80" }} /></div><span className="text-right tabular-nums">{p.seats}</span></li>)}</ul>)}
      </div>);
  } catch { return <section><h1 className="text-2xl font-semibold">Results are temporarily unavailable</h1><p className="mt-2 text-ink-soft">Reload in a minute.</p></section>; }
}
