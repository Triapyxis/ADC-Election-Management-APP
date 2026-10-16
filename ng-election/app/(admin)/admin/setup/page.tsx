import { userClient } from "@/lib/supabase/user";
import { AdminForm, type Field } from "@/components/AdminForm";
import { CONTEST_TYPES, TYPE_LABEL } from "@/lib/seats";
export const dynamic = "force-dynamic";

export default async function Setup() {
  const sb = await userClient(); const { data: { user } } = await sb.auth.getUser();
  const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", user?.id ?? "");
  if (!roles?.some((r) => r.role === "election_admin" || r.role === "super_admin")) return <section><h1 className="text-2xl font-semibold">Not available</h1><p className="mt-2 text-ink-soft">Election setup is for election administrators.</p></section>;
  const [el, pa, co] = await Promise.all([sb.from("elections").select("id,name").order("election_date", { ascending: false }).limit(50), sb.from("parties").select("id,abbreviation").order("abbreviation").limit(200), sb.from("contests").select("id,name,type").order("name").limit(500)]);
  const E = (el.data ?? []).map((e) => ({ value: e.id, label: e.name })), P = (pa.data ?? []).map((p) => ({ value: p.id, label: p.abbreviation })), C = (co.data ?? []).map((c) => ({ value: c.id, label: `${c.name} (${TYPE_LABEL[c.type as keyof typeof TYPE_LABEL]})` }));
  const f = (name: string, label: string, extra: Partial<Field> = {}): Field => ({ name, label, ...extra });
  const S = ({ t, kind, fields }: { t: string; kind: string; fields: Field[] }) => <section><h2 className="text-lg font-semibold">{t}</h2><div className="mt-3"><AdminForm endpoint="/api/admin/setup" fixed={{ kind }} fields={fields} submit={`Create ${kind}`} /></div></section>;
  return (<div className="space-y-12"><header><h1 className="text-2xl font-semibold">Election setup</h1><p className="mt-1 max-w-prose text-sm text-ink-soft">Use real, official information only. An election is hidden from the public until you tick Public.</p></header>
    <S t="New election" kind="election" fields={[f("name", "Name"), f("electionDate", "Date", { type: "date" }), f("status", "Status", { type: "select", options: ["upcoming", "live", "concluded"].map((x) => ({ value: x, label: x })) }), f("isPublic", "Public", { type: "checkbox" })]} />
    <S t="New party" kind="party" fields={[f("abbreviation", "Abbreviation (capitals)"), f("name", "Full name"), f("brandColour", "Brand colour, e.g. #0b6b3a", { optional: true }), f("logoUrl", "Logo URL (https)", { optional: true })]} />
    <S t="New contest" kind="contest" fields={[f("electionId", "Election", { type: "select", options: E }), f("type", "Type", { type: "select", options: CONTEST_TYPES.map((x) => ({ value: x, label: TYPE_LABEL[x] })) }), f("name", "Name"), f("stateId", "State id", { optional: true })]} />
    <S t="New candidate" kind="candidate" fields={[f("contestId", "Contest", { type: "select", options: C }), f("partyId", "Party", { type: "select", options: P }), f("fullName", "Full name"), f("photoUrl", "Photo URL (https)", { optional: true })]} /></div>);
}
