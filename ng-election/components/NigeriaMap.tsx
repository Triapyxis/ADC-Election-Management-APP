
import map from "@/lib/ng-map.json";

type Shape = {
  id: string;
  name: string;
  key: string;
  d: string;
};

const BASE_STATE = "#DCE9E1";
const FCT_BASE = "#A8CDB5";
const STATE_BORDER = "#FFFFFF";

/**
 * Server-rendered SVG choropleth.
 *
 * Verified leading-party data determines state colours.
 * States without verified results remain visibly neutral.
 * Leading is not the same as declared.
 */
export function NigeriaMap({
  fills,
  plain = false,
}: {
  fills: Record<string, string>;
  plain?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 1000 812"
      role="img"
      aria-label="Map of Nigeria's 36 states and the FCT. State colours show leading parties where verified results exist."
      className="h-auto w-full"
    >
      <g
        stroke={STATE_BORDER}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {(map as Shape[]).map((s) => {
          const hasVerifiedLeader = Boolean(fills[s.key]);
          const isFct = s.key === "fct";

          return (
            <a
              key={s.id}
              href={
                plain
                  ? undefined
                  : `/states/${encodeURIComponent(
                      s.key.replace(/ /g, "-")
                    )}`
              }
              aria-label={`${s.name}${
                hasVerifiedLeader
                  ? ", leading party data available"
                  : ", no verified results yet"
              }`}
              className={plain ? "" : "cursor-pointer"}
            >
              <path
                d={s.d}
                fill={
                  hasVerifiedLeader
                    ? fills[s.key]
                    : isFct
                      ? FCT_BASE
                      : BASE_STATE
                }
                stroke={isFct ? "#235347" : STATE_BORDER}
                strokeWidth={isFct ? 3 : 2}
                className={
                  plain
                    ? ""
                    : "transition-opacity duration-150 hover:opacity-75"
                }
              >
                <title>
                  {s.name}
                  {hasVerifiedLeader
                    ? ": leading party shown"
                    : ": no verified results yet"}
                </title>
              </path>
            </a>
          );
        })}
      </g>
    </svg>
  );
}
