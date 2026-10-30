
"use client";

import { useEffect, useState } from "react";

const INEC_CALENDAR = "https://inecnigeria.org/elections/calendar";
const PVC_LOOKUP = "https://cvr.inecnigeria.org/vvs";
const POLLING_UNIT_LOOKUP = "https://cvr.inecnigeria.org/pu";

function CountdownCard({
  label,
  date,
  now,
  primary = false,
}: {
  label: string;
  date: string;
  now: number | null;
  primary?: boolean;
}) {
  const target = new Date(date).getTime();
  const valid = Number.isFinite(target);
  const remaining = now === null || !valid
    ? null
    : Math.max(0, target - now);

  const totalSeconds = remaining === null
    ? 0
    : Math.floor(remaining / 1000);

  const finished = now !== null && valid && target <= now;

  const units = [
    ["Days", Math.floor(totalSeconds / 86400)],
    ["Hours", Math.floor((totalSeconds % 86400) / 3600)],
    ["Mins", Math.floor((totalSeconds % 3600) / 60)],
    ["Secs", totalSeconds % 60],
  ] as const;

  return (
    <div
      className={`overflow-hidden rounded-2xl border p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${
        primary
          ? "border-emerald-300/30 bg-gradient-to-br from-[#063B2B] via-[#07543A] to-[#087D4B] text-white"
          : "border-emerald-200 bg-gradient-to-br from-[#E8F8EE] via-white to-[#D6F3E1] text-[#063B2B]"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className={`text-xs font-bold uppercase tracking-wider ${
          primary ? "text-emerald-200" : "text-emerald-800"
        }`}>
          {label}
        </p>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
          primary
            ? "bg-white/15 text-emerald-100"
            : "bg-emerald-700/10 text-emerald-800"
        }`}>
          {primary ? "National election" : "State election"}
        </span>
      </div>

      <p className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
        {valid
          ? new Date(target).toLocaleDateString("en-NG", {
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: "Africa/Lagos",
            })
          : "Date to be confirmed"}
      </p>

      <div className="mt-5">
        {remaining === null ? (
          <p className="text-sm opacity-75">Countdown loading...</p>
        ) : finished ? (
          <p className="rounded-lg bg-black/10 p-3 text-sm font-semibold">
            Election day has arrived or this scheduled date has passed.
          </p>
        ) : (
          <div
            className="grid grid-cols-4 gap-2"
            aria-label={`${units[0][1]} days, ${units[1][1]} hours, ${units[2][1]} minutes and ${units[3][1]} seconds remaining`}
          >
            {units.map(([unit, value]) => (
              <div
                key={unit}
                className={`rounded-xl px-2 py-3 text-center ${
                  primary
                    ? "border border-white/15 bg-white/10"
                    : "border border-emerald-100 bg-white/80"
                }`}
              >
                <p className="text-2xl font-extrabold tabular-nums sm:text-3xl">
                  {String(value).padStart(unit === "Days" ? 1 : 2, "0")}
                </p>
                <p className={`mt-1 text-xs ${
                  primary ? "text-emerald-100" : "text-emerald-800"
                }`}>
                  {unit}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <a
        href={INEC_CALENDAR}
        target="_blank"
        rel="noreferrer"
        className={`mt-5 inline-flex items-center gap-2 text-sm font-semibold underline underline-offset-4 ${
          primary
            ? "text-emerald-100 hover:text-white"
            : "text-emerald-800 hover:text-emerald-950"
        }`}
      >
        Verify date on INEC calendar ↗
      </a>
    </div>
  );
}

export function VoterServices() {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const presidentialDate =
    process.env.NEXT_PUBLIC_PRESIDENTIAL_ELECTION_DATE ||
    "2027-01-16T00:00:00+01:00";

  const governorshipDate =
    process.env.NEXT_PUBLIC_GOVERNORSHIP_ELECTION_DATE ||
    "2027-02-06T00:00:00+01:00";

  return (
    <section
      aria-labelledby="election-readiness-title"
      className="mb-8 overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-lg"
    >
      {/* SECTION HEADER */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#051F20] via-[#07543A] to-[#078849] px-5 py-8 text-white sm:px-8 sm:py-10">
        <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border-[35px] border-white/5" />
        <div className="pointer-events-none absolute -bottom-24 right-1/3 h-56 w-56 rounded-full bg-emerald-300/10 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="inline-flex rounded-full border border-emerald-200/30 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">
              Be election-ready
            </span>

            <h2
              id="election-readiness-title"
              className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl"
            >
              Know your date. Know your polling unit.
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-emerald-100">
              Stay informed, check your voter information and prepare for
              Nigeria&apos;s upcoming elections.
            </p>
          </div>

          <a
            href={INEC_CALENDAR}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            Official INEC calendar ↗
          </a>
        </div>
      </div>

      <div className="space-y-8 p-5 sm:p-8">
        {/* COUNTDOWNS */}
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Election countdown
              </p>
              <h3 className="mt-1 text-lg font-bold text-[#063B2B]">
                The dates to keep in view
              </h3>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
              Check official timetable updates
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <CountdownCard
              label="Presidential / National Assembly"
              date={presidentialDate}
              now={now}
              primary
            />

            <CountdownCard
              label="Governorship / State House of Assembly"
              date={governorshipDate}
              now={now}
            />
          </div>

          <p className="mt-3 text-xs leading-relaxed text-ink-faint">
            Countdowns use the dates currently listed on INEC&apos;s online
            calendar. Check INEC for any official timetable changes.
          </p>
        </div>

        {/* VOTER SERVICES */}
        <div>
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Voter information
            </p>
            <h3 className="mt-1 text-lg font-bold text-[#063B2B]">
              Access official voter services
            </h3>
            <p className="mt-1 text-sm text-ink-soft">
              Use INEC&apos;s official channels to verify your details and
              locate your polling unit.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <a
              href={PVC_LOOKUP}
              target="_blank"
              rel="noreferrer"
              className="group rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5 transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-md"
            >
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-700 text-2xl text-white shadow-sm">
                ✓
              </span>
              <h4 className="mt-4 font-bold text-[#063B2B] group-hover:text-emerald-700">
                Check your PVC / voter status
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                Open INEC&apos;s voter verification service to check your
                registration or PVC information.
              </p>
              <span className="mt-4 inline-block text-sm font-bold text-emerald-700 underline underline-offset-4">
                Open official INEC service ↗
              </span>
            </a>

            <a
              href={POLLING_UNIT_LOOKUP}
              target="_blank"
              rel="noreferrer"
              className="group rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-5 transition hover:-translate-y-1 hover:border-sky-300 hover:shadow-md"
            >
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-sky-700 text-2xl text-white shadow-sm">
                ⌖
              </span>
              <h4 className="mt-4 font-bold text-[#063B2B] group-hover:text-sky-700">
                Find your polling unit
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                Use INEC&apos;s official locator to look up your assigned
                polling location.
              </p>
              <span className="mt-4 inline-block text-sm font-bold text-sky-700 underline underline-offset-4">
                Open polling unit locator ↗
              </span>
            </a>

            <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-5">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-amber-500 text-2xl text-white shadow-sm">
                SMS
              </span>
              <h4 className="mt-4 font-bold text-[#063B2B]">
                Find your polling unit by SMS
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                INEC has published an SMS lookup method. Text your state,
                surname and the last 6 digits of your VIN in this format:
              </p>

              <p className="mt-3 rounded-lg border border-amber-100 bg-white p-3 text-center text-sm font-extrabold tracking-wide text-[#063B2B]">
                STATE SURNAME 123456
              </p>

              <p className="mt-3 text-sm text-ink-soft">
                Published numbers:
              </p>
              <p className="mt-1 text-sm font-bold text-amber-800">
                <a href="sms:09062830860" className="underline">09062830860</a>
                {" or "}
                <a href="sms:09062830861" className="underline">09062830861</a>
              </p>

              <p className="mt-3 text-xs leading-relaxed text-ink-faint">
                These numbers appear in an older INEC publication. Confirm
                they are still active with INEC before sending your details.
                This website does not collect or send your VIN.
              </p>

              <a
                href="https://www.inecnigeria.org/wp-content/uploads/2023/02/PVCs-Collected-Registered-Voters.pdf"
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block text-sm font-bold text-amber-800 underline underline-offset-4"
              >
                View INEC&apos;s published guidance ↗
              </a>
            </div>
          </div>
        </div>

        {/* PRIVACY NOTICE */}
        <div className="flex gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <span className="text-xl" aria-hidden="true">🔒</span>
          <p className="text-xs leading-relaxed text-emerald-950">
            <strong>Your privacy matters.</strong> This website does not ask
            you to submit your VIN or date of birth for these checks. Enter
            personal voter details only through INEC&apos;s official services
            or verified official channels.
          </p>
        </div>
      </div>
    </section>
  );
}
