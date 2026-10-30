
export function VoterServices() {
  const services = [
    {
      number: "01",
      title: "Check your PVC / voter status",
      description:
        "Open INEC's voter verification service to check your registration or PVC information.",
      action: "Open official INEC service",
      href: "https://cvr.inecnigeria.org/vvs",
    },
    {
      number: "02",
      title: "Find your polling unit",
      description:
        "Use INEC's official locator to look up your assigned polling location.",
      action: "Open polling unit locator",
      href: "https://cvr.inecnigeria.org/pu",
    },
    {
      number: "03",
      title: "Election calendar",
      description:
        "Check official election dates, schedules and important deadlines.",
      action: "View INEC calendar",
      href: "https://inecnigeria.org/elections/calendar",
    },
    {
      number: "04",
      title: "Official election information",
      description:
        "Visit INEC's official website for election information and announcements.",
      action: "Visit INEC website",
      href: "https://www.inecnigeria.org/",
    },
  ];

  return (
    <section className="relative overflow-hidden rounded-3xl bg-[#063B2B] px-5 py-10 text-white shadow-xl sm:px-8 sm:py-14">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#20C878]/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -left-20 h-64 w-64 rounded-full bg-[#078849]/30 blur-3xl" />

      <div className="relative mx-auto max-w-7xl">
        <div className="mb-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#20C878]/40 bg-[#078849]/30 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[#B9F5D4]">
            <span className="h-2 w-2 rounded-full bg-[#20C878]" />
            Official voter resources
          </span>

          <h2 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">
            YOUR VOTE. YOUR RIGHT.
          </h2>

          <p className="mt-3 max-w-xl text-sm leading-7 text-[#D9F5E5] sm:text-base">
            Everything you need to prepare for the next election.
            Access official INEC services and stay informed.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {services.map((service) => (
            <a
              key={service.number}
              href={service.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex min-h-[245px] flex-col rounded-2xl border border-white/70 bg-white p-5 text-[#063B2B] shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#20C878] hover:shadow-2xl"
            >
              <div className="mb-6 flex items-center justify-between">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#D9F5E5] text-lg font-extrabold text-[#078849] transition group-hover:bg-[#078849] group-hover:text-white">
                  {service.number}
                </span>

                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F0F7F2] text-[#078849] transition group-hover:bg-[#078849] group-hover:text-white">
                  ↗
                </span>
              </div>

              <h3 className="text-lg font-bold tracking-tight">
                {service.title}
              </h3>

              <p className="mt-2 flex-1 text-sm leading-6 text-[#53665B]">
                {service.description}
              </p>

              <div className="mt-6 border-t border-[#E5EEE8] pt-4 text-sm font-bold text-[#078849]">
                {service.action} →
              </div>
            </a>
          ))}
        </div>

        <div className="mt-7 border-t border-white/15 pt-5">
          <a
            href="https://www.inecnigeria.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold text-[#20C878] hover:text-white"
          >
            Visit INEC official website →
          </a>
        </div>
      </div>
    </section>
  );
}
