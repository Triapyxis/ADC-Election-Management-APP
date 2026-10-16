import map from "@/lib/ng-map.json";
type Shape = { id: string; name: string; key: string; d: string };
/** Server-rendered SVG choropleth. Fill = leading party's brand colour from real verified data;
 *  states with no verified votes stay neutral. Leading is not the same as declared. */
export function NigeriaMap({ fills, plain = false }: { fills: Record<string, string>; plain?: boolean }) {
  return (
    <svg viewBox="0 0 1000 812" role="img" aria-label="Map of Nigeria's 36 states and the FCT, coloured by leading party where verified results exist" className="h-auto w-full">
      <g stroke="#f7f6f2" strokeWidth={1} strokeLinejoin="round">
        {(map as Shape[]).map((s) => (
          <a key={s.id} href={plain ? undefined : `/states/${encodeURIComponent(s.key.replace(/ /g, "-"))}`} aria-label={s.name}>
            <path d={s.d} fill={fills[s.key] ?? "#e4e2d9"} className={s.key === "fct" ? "stroke-ink" : "hover:opacity-80"}>
              <title>{s.name}{fills[s.key] ? "" : ": no verified results yet"}</title>
            </path>
          </a>
        ))}
      </g>
    </svg>
  );
}
