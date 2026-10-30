
"use client";

import { useState } from "react";
import { NigeriaMap } from "@/components/NigeriaMap";
import {
  MODES,
  MODE_LABEL,
  type Mode,
} from "@/lib/map-modes";

type Props = {
  initialMode: Mode;
  fillsByMode: Record<string, Record<string, string>>;
  notesByMode: Record<string, string>;
  legendsByMode: Record<string, { label: string; colour: string }[]>;
};

export function MapView({
  initialMode,
  fillsByMode,
  notesByMode,
  legendsByMode,
}: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);

  const fills = fillsByMode[mode] ?? {};
  const legend = legendsByMode[mode] ?? [];
  const note = notesByMode[mode] ?? "";

  return (
    <section
      aria-label="State map"
      className="rounded-2xl border border-rule bg-white p-5 shadow-card sm:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-action">
            Geographic overview
          </p>
          <h2 className="mt-1 text-xl font-bold text-brand-forest">
            Results by state
          </h2>
        </div>

        <span className="rounded-full bg-brand-mint px-3 py-1 text-xs font-semibold text-brand-forest">
          Nigeria
        </span>
      </div>

      <nav
        aria-label="Map view"
        className="mt-5 flex flex-wrap gap-2 border-b border-rule pb-4 text-sm"
      >
        {MODES.map((x) => (
          <button
            key={x}
            type="button"
            onClick={() => setMode(x)}
            aria-pressed={x === mode}
            className={
              x === mode
                ? "rounded-lg bg-brand-forest px-3 py-2 font-semibold text-white"
                : "rounded-lg bg-paper px-3 py-2 font-medium text-ink-soft transition hover:bg-brand-mint hover:text-brand-forest"
            }
          >
            {MODE_LABEL[x]}
          </button>
        ))}
      </nav>

      <div className="mt-5 overflow-hidden rounded-xl border border-brand-mint bg-[#F2F7F3] p-2 sm:p-4">
        <NigeriaMap fills={fills} />
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-soft">
        {note} Select a state for its results.
      </p>

      {legend.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-3 border-t border-rule pt-4 text-sm">
          {legend.map((c) => (
            <li
              key={c.label}
              className="flex items-center gap-2 text-ink-soft"
            >
              <span
                className="h-3 w-3 shrink-0 rounded-sm"
                style={{ background: c.colour }}
              />
              {c.label}
            </li>
          ))}
        </ul>
      )}

      {Object.keys(fills).length === 0 && (
        <div className="mt-4 flex items-center gap-2 text-xs text-ink-faint">
          <span className="h-3 w-3 rounded-sm bg-[#DCE9E1]" />
          No verified result data available for this view
        </div>
      )}

      <p className="mt-4 text-xs text-ink-faint">
        Simplified boundaries, Simplemaps (free licence).
      </p>
    </section>
  );
}
