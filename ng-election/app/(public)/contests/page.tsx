import Link from "next/link";
import { db } from "@/lib/supabase/server";
import { CONTEST_TYPES, TYPE_LABEL, type ContestType } from "@/lib/seats";
export const dynamic = "force-dynamic";

export default async function Contests({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams; const t = (CONTEST_TYPES as readonly string[]).includes(type ?? "") ? (type as ContestType) : "presidential";
  const s = db();
  const { data: el, error: e1 } = await s.from("elections").select("id,name").order("election_date", { ascending: false }).limit(1).maybeSingle();
  if (e1) return <section><h1 className="text-2xl font-semibold">Contests are temporarily unavailable</h1><p className="mt-2 text-ink-soft">Reload in a minute.</p></section>;
  if (!el) return <section><h1 className="text-2xl font-semibold">No election is live</h1><p className="mt-2 text-ink-soft">Awaiting results.</p></section>;
  const { data } = await s.from("contests").select("id,name").eq("election_id", el.id).eq("type", t).order("name").limit(500);
  return (
    <div><h1 className="text-3xl font-semibold">Contests</h1><p className="mt-1 text-ink-soft">{el.name}</p>
      <nav aria-label="Contest type" className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">{CONTEST_TYPES.map((c) => <Link key={c} href={`/contests?type=${c}`} className={c === t ? "font-semibold underline" : "text-green underline"}>{TYPE_LABEL[c]}</Link>)}
        {t !== "presidential" && <Link href={`/seats/${t}`} className="ml-auto text-green underline">Seats led</Link>}</nav>
      {!data?.length ? <p className="mt-6 text-ink-soft">No {TYPE_LABEL[t]} contests have been set up for this election.</p> : <ul className="mt-6 grid gap-x-8 sm:grid-cols-2">{data.map((c) => <li key={c.id} className="border-b border-rule"><Link href={`/contests/${c.id}`} className="block py-2.5 hover:bg-rule/30">{c.name}</Link></li>)}</ul>}
    </div>);
}
