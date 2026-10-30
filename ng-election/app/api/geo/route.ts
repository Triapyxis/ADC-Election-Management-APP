
import { NextResponse } from "next/server";
import { userClient } from "@/lib/supabase/user";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

export async function GET(req: Request) {
  try {
    const sb = await userClient();

    const {
      data: { user },
      error: authError,
    } = await sb.auth.getUser();

    if (authError || !user) {
      return json({ error: "Sign in required." }, 401);
    }

    const url = new URL(req.url);
    const level = url.searchParams.get("level");
    const parent = url.searchParams.get("parent") ?? "";

    const validLevels = ["states", "lgas", "wards", "units"];

    if (!level || !validLevels.includes(level)) {
      return json({ error: "Invalid geography level." }, 400);
    }

    if (level !== "states" && !UUID.test(parent)) {
      return json({ error: "A valid parent ID is required." }, 400);
    }

    let data: any[] | null = null;
    let error: any = null;

    if (level === "states") {
      ({ data, error } = await sb
        .from("states")
        .select("id,name")
        .order("name")
        .limit(100));
    }

    if (level === "lgas") {
      ({ data, error } = await sb
        .from("lgas")
        .select("id,name")
        .eq("state_id", parent)
        .order("name")
        .limit(1000));
    }

    if (level === "wards") {
      ({ data, error } = await sb
        .from("wards")
        .select("id,name")
        .eq("lga_id", parent)
        .order("name")
        .limit(1000));
    }

    if (level === "units") {
      // Do not query polling_units directly.
      // The migration provides this safe directory function.
      ({ data, error } = await sb.rpc(
        "public_polling_units_in_ward",
        { p_ward: parent }
      ));
    }

    if (error) {
      console.error(`Geography API error (${level}):`, error);

      if (
        level === "units" &&
        (error.code === "PGRST202" || error.code === "42883")
      ) {
        return json({
          error:
            "The polling-unit directory database function is missing. Apply migration 0031_public_geography_directory.sql.",
          code: error.code,
        }, 500);
      }

      return json({
        error: `Could not load ${level}. Check the geography database permissions and imported records.`,
        code: error.code ?? "UNKNOWN",
      }, 500);
    }

    return json({ items: data ?? [] });
  } catch (error) {
    console.error("Geography API failed:", error);

    return json({
      error: "The geography service could not be reached. Please try again.",
    }, 500);
  }
}
