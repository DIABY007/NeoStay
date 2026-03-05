import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          source: "supabase",
          message: "Supabase responded with an error.",
          details: error.message,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      source: "supabase",
      message: "Configuration loaded and Supabase API reachable.",
      hasSession: Boolean(data.session),
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        ok: false,
        source: "supabase",
        message: "Missing or invalid environment configuration.",
        details: message,
      },
      { status: 500 },
    );
  }
}
