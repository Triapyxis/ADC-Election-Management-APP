
"use client";

import { useEffect, useState } from "react";

type CountdownValues = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

function getCountdown(target: string): CountdownValues {
  const difference = Math.max(
    0,
    new Date(target).getTime() - Date.now()
  );

  return {
    days: Math.floor(difference / 86400000),
    hours: Math.floor((difference % 86400000) / 3600000),
    minutes: Math.floor((difference % 3600000) / 60000),
    seconds: Math.floor((difference % 60000) / 1000),
  };
}

function CountdownCard({
  title,
  date,
  target,
  featured,
}: {
  title: string;
  date: string;
  target: string;
  featured?: boolean;
}) {
  const [countdown, setCountdown] = useState<CountdownValues | null>(null);

  useEffect(() => {
    const update = () => setCountdown(getCountdown(target));

    update();
    const timer = window.setInterval(update, 1000);

    return () => window.clearInterval(timer);
  }, [target]);

  const units = [
    { label: "Days", value: countdown?.days ?? 0 },
    { label: "Hours", value: countdown?.hours ?? 0 },
    { label: "Mins", value: countdown?.minutes ?? 0 },
    { label: "Secs", value: countdown?.seconds ?? 0 },
  ];

  return (
    <div
      className={`rounded-xl border p-4 ${
        featured
          ? "border-green/30 bg-green/5"
          : "border-rule bg-paper-raised"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
        {title}
      </p>

      <p className="mt-1 text-lg font-semibold">{date}</p>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {units.map((unit) => (
          <div
            key={unit.label}
            className="rounded-lg bg-paper px-2 py-2 text-center"
          >
            <p className="text-xl font-semibold tabular-nums sm:text-2xl">
              {String(unit.value).padStart(2, "0")}
            </p>
            <p className="text-xs text-ink-soft">{unit.label}</p>
          </div>
        ))}
      </div>

      <a
        className="mt-3 inline-block text-sm font-medium text-green underline underline-offset-4"
        href="https://inecnigeria.org/elections/calendar"
        target="_blank"
        rel="noopener noreferrer"
      >
        Verify date on INEC calendar ↗
      </a>
    </div>
  );
}

export function ElectionCountdown() {
  return (
    <section aria-label="Election countdown">
      <div className="grid gap-3 md:grid-cols-2">
        <CountdownCard
          title="Presidential / National Assembly"
          date="16 January 2027"
          target="2027-01-16T00:00:00+01:00"
          featured
        />

        <CountdownCard
          title="Governorship / State House of Assembly"
          date="6 February 2027"
          target="2027-02-06T00:00:00+01:00"
        />
      </div>
    </section>
  );
}
