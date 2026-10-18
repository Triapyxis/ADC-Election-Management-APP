"use client";

import { useState } from "react";
import {
  isAgentAccessOpen,
  type AgentAccessControl,
  type AgentAccessMode,
} from "@/lib/election-access";

type Election = {
  id: string;
  name: string;
  election_date: string;
};

type ContestType = {
  value: string;
  label: string;
};

type Props = {
  elections: Election[];
  controls: AgentAccessControl[];
  contestTypes: ContestType[];
};

type Draft = {
  accessMode: AgentAccessMode;
  opensAt: string;
  closesAt: string;
  reason: string;
};

const localInput = (value: string | null | undefined) => {
  if (!value) return "";

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const defaultWindow = (date: string) => {
  const start = `${date}T00:00`;
  const endDate = new Date(`${date}T12:00:00`);

  endDate.setDate(endDate.getDate() + 1);

  const pad = (n: number) => String(n).padStart(2, "0");

  const end = `${endDate.getFullYear()}-${pad(
    endDate.getMonth() + 1,
  )}-${pad(endDate.getDate())}T00:00`;

  return { start, end };
};

const key = (electionId: string, contestType: string) =>
  `${electionId}:${contestType}`;

export function ElectionAccessControls({
  elections,
  controls,
  contestTypes,
}: Props) {
  const [saved, setSaved] = useState<Record<string, AgentAccessControl>>(
    () =>
      Object.fromEntries(
        controls.map((control) => [
          key(control.election_id, control.contest_type),
          control,
        ]),
      ),
  );

  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    const result: Record<string, Draft> = {};

    for (const election of elections) {
      for (const contest of contestTypes) {
        const k = key(election.id, contest.value);
        const control = controls.find(
          (item) =>
            item.election_id === election.id &&
            item.contest_type === contest.value,
        );
        const window = defaultWindow(election.election_date);

        result[k] = {
          accessMode: control?.access_mode ?? "locked",
          opensAt: localInput(control?.opens_at) || window.start,
          closesAt: localInput(control?.closes_at) || window.end,
          reason: control?.reason ?? "",
        };
      }
    }

    return result;
  });

  const [messages, setMessages] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const update = (k: string, patch: Partial<Draft>) => {
    setDrafts((old) => {
      const current = old[k];

      if (!current) return old;

      const next: Draft = {
        ...current,
        ...patch,
        accessMode: patch.accessMode ?? current.accessMode,
      };

      return { ...old, [k]: next };
    });
  };

  async function save(election: Election, contestType: ContestType) {
    const k = key(election.id, contestType.value);
    const draft = drafts[k];

    if (!draft) {
      setMessages((old) => ({
        ...old,
        [k]: "Draft settings are missing. Refresh the page and try again.",
      }));
      return;
    }

    if (
      draft.accessMode === "scheduled" &&
      (
        !draft.opensAt ||
        !draft.closesAt ||
        !Number.isFinite(new Date(draft.opensAt).getTime()) ||
        !Number.isFinite(new Date(draft.closesAt).getTime()) ||
        new Date(draft.closesAt) <= new Date(draft.opensAt)
      )
    ) {
      setMessages((old) => ({
        ...old,
        [k]: "Choose valid opening and closing times; closing must be after opening.",
      }));
      return;
    }

    if (draft.accessMode !== "scheduled" && !draft.reason.trim()) {
      setMessages((old) => ({
        ...old,
        [k]: "Enter a reason for manually opening or locking access.",
      }));
      return;
    }

    setBusy(k);
    setMessages((old) => ({ ...old, [k]: "Saving…" }));

    try {
      const response = await fetch("/api/admin/election-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          electionId: election.id,
          contestType: contestType.value,
          accessMode: draft.accessMode,
          opensAt:
            draft.accessMode === "scheduled"
              ? new Date(draft.opensAt).toISOString()
              : null,
          closesAt:
            draft.accessMode === "scheduled"
              ? new Date(draft.closesAt).toISOString()
              : null,
          reason: draft.reason,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessages((old) => ({
          ...old,
          [k]: result.error ?? "Could not save settings.",
        }));
        return;
      }

      if (!result.control) {
        setMessages((old) => ({
          ...old,
          [k]: "The server did not return the saved access settings. Refresh and verify the result.",
        }));
        return;
      }

      setSaved((old) => ({
        ...old,
        [k]: result.control as AgentAccessControl,
      }));

      setMessages((old) => ({ ...old, [k]: "Saved successfully." }));
    } catch {
      setMessages((old) => ({
        ...old,
        [k]: "Network error. Check your connection and try again.",
      }));
    } finally {
      setBusy(null);
    }
  }

  if (!elections.length) {
    return (
      <p className="text-sm text-ink-soft">
        Create an election in Election setup before configuring agent access.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {elections.map((election) => (
        <section
          key={election.id}
          className="space-y-4 rounded-lg border border-rule p-4"
        >
          <header>
            <h2 className="text-lg font-semibold">{election.name}</h2>
            <p className="text-sm text-ink-soft">
              Election date:{" "}
              {new Date(
                `${election.election_date}T12:00:00`,
              ).toLocaleDateString("en-NG")}
              . Each contest type is controlled independently.
            </p>
          </header>

          <div className="grid gap-4 lg:grid-cols-2">
            {contestTypes.map((contest) => {
              const k = key(election.id, contest.value);
              const draft = drafts[k];

              if (!draft) {
                return (
                  <article
                    key={contest.value}
                    className="rounded-md border border-rule p-3"
                  >
                    <h3 className="font-semibold">{contest.label}</h3>
                    <p className="mt-2 text-sm text-ink-soft">
                      Draft settings are missing. Refresh the page and try
                      again.
                    </p>
                  </article>
                );
              }

              const control = saved[k];

              // Use the database field names required by isAgentAccessOpen.
              // Invalid or incomplete scheduled dates should not crash rendering.
              let open = false;

              try {
                open = isAgentAccessOpen({
                  access_mode: draft.accessMode,
                  opens_at:
                    draft.accessMode === "scheduled" && draft.opensAt
                      ? new Date(draft.opensAt).toISOString()
                      : null,
                  closes_at:
                    draft.accessMode === "scheduled" && draft.closesAt
                      ? new Date(draft.closesAt).toISOString()
                      : null,
                });
              } catch {
                open = false;
              }

              return (
                <article
                  key={contest.value}
                  className="rounded-md border border-rule p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="font-semibold">{contest.label}</h3>
                    <span
                      className={`rounded px-2 py-1 text-xs font-semibold ${
                        open
                          ? "bg-green/10 text-green"
                          : "bg-status-disputed/10 text-status-disputed"
                      }`}
                    >
                      {open ? "AGENT ACCESS OPEN" : "AGENT ACCESS LOCKED"}
                    </span>
                  </div>

                  <label className="mt-3 block text-sm">
                    Access mode
                    <select
                      className="mt-1 w-full border border-rule bg-paper-raised px-3 py-2"
                      value={draft.accessMode}
                      onChange={(event) =>
                        update(k, {
                          accessMode: event.target.value as AgentAccessMode,
                        })
                      }
                    >
                      <option value="scheduled">
                        Scheduled window (automatic open/close)
                      </option>
                      <option value="open">Open now (manual override)</option>
                      <option value="locked">
                        Locked now (manual override)
                      </option>
                    </select>
                  </label>

                  {draft.accessMode === "scheduled" && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="block text-sm">
                        Opens at
                        <input
                          required
                          type="datetime-local"
                          className="mt-1 w-full border border-rule bg-paper-raised px-2 py-2"
                          value={draft.opensAt}
                          onChange={(event) =>
                            update(k, { opensAt: event.target.value })
                          }
                        />
                      </label>

                      <label className="block text-sm">
                        Closes at
                        <input
                          required
                          type="datetime-local"
                          className="mt-1 w-full border border-rule bg-paper-raised px-2 py-2"
                          value={draft.closesAt}
                          onChange={(event) =>
                            update(k, { closesAt: event.target.value })
                          }
                        />
                      </label>
                    </div>
                  )}

                  <label className="mt-3 block text-sm">
                    Reason / admin note
                    {draft.accessMode !== "scheduled"
                      ? " (required)"
                      : " (optional)"}
                    <textarea
                      rows={2}
                      maxLength={500}
                      className="mt-1 w-full border border-rule bg-paper-raised px-3 py-2"
                      placeholder="e.g. Presidential election polling and collation window"
                      value={draft.reason}
                      onChange={(event) =>
                        update(k, { reason: event.target.value })
                      }
                    />
                  </label>

                  {control && (
                    <p className="mt-2 text-xs text-ink-soft">
                      Saved access settings are available.
                    </p>
                  )}

                  <button
                    type="button"
                    disabled={busy === k}
                    onClick={() => void save(election, contest)}
                    className="mt-3 rounded bg-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {busy === k ? "Saving…" : "Save access settings"}
                  </button>

                  {messages[k] && (
                    <p role="status" className="mt-2 text-sm text-ink-soft">
                      {messages[k]}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
