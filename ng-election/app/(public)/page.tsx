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
