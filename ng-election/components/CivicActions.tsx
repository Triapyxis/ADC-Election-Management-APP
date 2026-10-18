"use client";

import { useEffect, useMemo, useState } from "react";

const INEC_CALENDAR = "https://inecnigeria.org/elections/calendar";
const PVC_LOOKUP = "https://cvr.inecnigeria.org/vvs";
const POLLING_UNIT_LOOKUP = "https://cvr.inecnigeria.org/pu";

function getParts(target: number, now: number) {
  const remaining = Math.max(0, target - now);
  const totalSeconds = Math.floor(remaining / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    finished: target <= now,
  };
}

function Countdown({ date, label, primary = false }: { date: string; label: string; primary?: boolean }) {
  const target = useMemo(() => Date.parse(date), [date]);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const valid = Number.isFinite(target);
  const parts = now === null || !valid ? null : getParts(target, now);
  const dateLabel = valid
    ? new Date(target).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" })
    : "Date to be confirmed";

  return (
    <div className={`rounded-xl border p-4 ${primary ? "border-green/30 bg-green/5" : "border-rule bg-paper-raised"}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-1 text-lg font-semibold">{dateLabel}</p>
      {parts ? parts.finished ? (
        <p className="mt-3 text-sm font-medium">Election day has arrived or this scheduled date has passed.</p>
      ) : (
        <div className="mt-3 grid grid-cols-4 gap-2" aria-label={`${parts.days} days, ${parts.hours} hours, ${parts.minutes} minutes and ${parts.seconds} seconds remaining`}>
          {([ ["Days", parts.days], ["Hours", parts.hours], ["Mins", parts.minutes], ["Secs", parts.seconds] ] as const).map(([unit, value]) => (
            <div key={unit} className="rounded-lg bg-paper px-2 py-2 text-center">
              <p className="text-xl font-semibold tabular-nums sm:text-2xl">{String(value).padStart(unit === "Days" ? 1 : 2, "0")}</p>
              <p className="text-xs text-ink-soft">{unit}</p>
            </div>
          ))}
        </div>
      ) : <p className="mt-3 text-sm text-ink-soft">Countdown loading…</p>}
      <a className="mt-3 inline-block text-sm font-medium text-green underline underline-offset-4" href={INEC_CALENDAR} target="_blank" rel="noreferrer">Verify date on INEC calendar ↗</a>
    </div>
  );
}

export function CivicActions() {
  // Defaults reflect the dates currently listed on INEC's official online election calendar.
  // They can be overridden in the deployment environment if INEC publishes a revised schedule.
  const presidentialDate = process.env.NEXT_PUBLIC_PRESIDENTIAL_ELECTION_DATE || "2027-01-16T00:00:00+01:00";
  const governorshipDate = process.env.NEXT_PUBLIC_GOVERNORSHIP_ELECTION_DATE || "2027-02-06T00:00:00+01:00";

  return (
    <section aria-labelledby="civic-actions-title" className="mb-8 space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-green">Be election-ready</p>
          <h2 id="civic-actions-title" className="mt-1 text-2xl font-semibold">Know your date. Know your polling unit.</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">Countdowns use the dates currently listed on INEC’s online calendar. Check INEC for any official timetable changes.</p>
        </div>
        <a href={INEC_CALENDAR} target="_blank" rel="noreferrer" className="text-sm font-medium text-green underline underline-offset-4">Official INEC election calendar ↗</a>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Countdown date={presidentialDate} label="Presidential / National Assembly" primary />
        <Countdown date={governorshipDate} label="Governorship / State House of Assembly" />
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <a href={PVC_LOOKUP} target="_blank" rel="noreferrer" className="group flex h-full items-start gap-3 rounded-xl border border-rule bg-paper-raised p-4 transition hover:border-green/50 focus-visible:outline-green">
          <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-green/10 text-green"><svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8" cy="10" r="2"/><path d="M5.5 15c.5-1.5 1.4-2.2 2.5-2.2s2 .7 2.5 2.2M13 9h5M13 13h5"/></svg></span>
          <span className="min-w-0 flex-1"><span className="block font-semibold group-hover:underline">Check your PVC / voter status</span><span className="mt-1 block text-sm text-ink-soft">Open INEC’s voter verification service to check your registration or PVC information.</span><span className="mt-3 block text-sm font-medium text-green underline underline-offset-4">Open official INEC service ↗</span></span>
        </a>
        <a href={POLLING_UNIT_LOOKUP} target="_blank" rel="noreferrer" className="group flex h-full items-start gap-3 rounded-xl border border-rule bg-paper-raised p-4 transition hover:border-green/50 focus-visible:outline-green">
          <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-green/10 text-green"><svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/></svg></span>
          <span className="min-w-0 flex-1"><span className="block font-semibold group-hover:underline">Find your polling unit</span><span className="mt-1 block text-sm text-ink-soft">Use INEC’s official locator to look up your assigned polling location.</span><span className="mt-3 block text-sm font-medium text-green underline underline-offset-4">Open polling unit locator ↗</span></span>
        </a>
        <div className="flex h-full items-start gap-3 rounded-xl border border-rule bg-paper-raised p-4">
          <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-green/10 text-green"><svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 5h16v12H8l-4 3V5Z"/><path d="M7 9h10M7 13h7"/></svg></span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Find your polling unit by SMS</p>
            <p className="mt-1 text-sm text-ink-soft">INEC has published an SMS lookup method. Text your state, surname and the last 6 digits of your VIN in this format:</p>
            <p className="mt-2 rounded-lg bg-paper p-2 text-sm font-semibold">STATE SURNAME 123456</p>
            <p className="mt-2 text-sm text-ink-soft">Published numbers: <a className="font-medium underline underline-offset-4" href="sms:09062830860">09062830860</a> or <a className="font-medium underline underline-offset-4" href="sms:09062830861">09062830861</a>.</p>
            <p className="mt-2 text-xs text-ink-faint">These numbers appear in an older INEC publication. Confirm they are still active with INEC before sending your details. This website does not collect or send your VIN.</p>
            <a className="mt-3 inline-block text-sm font-medium text-green underline underline-offset-4" href="https://www.inecnigeria.org/wp-content/uploads/2023/02/PVCs-Collected-Registered-Voters.pdf" target="_blank" rel="noreferrer">View INEC's published guidance ↗</a>
          </div>
        </div>
      </div>
      <p className="text-xs text-ink-faint">For your privacy, this website does not ask you to submit your VIN or date of birth for these checks. Enter personal voter details only through INEC’s official services or verified official channels.</p>
    </section>
  );
}
