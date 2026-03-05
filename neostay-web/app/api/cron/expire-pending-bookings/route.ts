import { NextResponse } from "next/server";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization") ?? "";

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServiceRoleClient();

  const { data, error } = await supabase
    .from("bookings")
    .update({ status: "expired" })
    .eq("status", "pending")
    .lte("expires_at", new Date().toISOString())
    .select("id");

  if (error) {
    return NextResponse.json(
      { success: false, error: `Expiration cron echouee: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    expiredCount: data?.length ?? 0,
  });
}
