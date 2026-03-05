import { NextResponse } from "next/server";

import { ensureHotelOperatorForSlug } from "@/lib/auth/hotel-operator";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ hotelSlug: string }> };

const ALLOWED_STATUSES = ["pending", "confirmed", "cancelled", "expired"] as const;
type BookingStatus = (typeof ALLOWED_STATUSES)[number];

function isBookingStatus(value: string): value is BookingStatus {
  return ALLOWED_STATUSES.includes(value as BookingStatus);
}

export async function GET(request: Request, { params }: Params) {
  const { hotelSlug } = await params;
  const auth = await ensureHotelOperatorForSlug(hotelSlug);

  if (!auth.ok || !auth.hotelId) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const statusParam = (url.searchParams.get("status") ?? "all").trim().toLowerCase();

  const supabase = createSupabaseServiceRoleClient();

  function buildQuery(includeBookedHours: boolean) {
    const selectColumns = includeBookedHours
      ? "id, guest_name, guest_phone, special_request, booking_formula, booked_hours, booked_days, check_in_date, check_out_date, status, payment_proof_path, expires_at, created_at, room_types(name)"
      : "id, guest_name, guest_phone, special_request, booking_formula, check_in_date, check_out_date, status, payment_proof_path, expires_at, created_at, room_types(name)";

    let query = supabase
      .from("bookings")
      .select(selectColumns)
      .eq("hotel_id", auth.hotelId)
      .order("created_at", { ascending: false });

    if (statusParam !== "all") {
      query = query.eq("status", statusParam);
    }

    return query;
  }

  if (statusParam !== "all") {
    if (!isBookingStatus(statusParam)) {
      return NextResponse.json(
        { success: false, error: "Filtre status invalide." },
        { status: 400 },
      );
    }
  }

  type BookingRow = Record<string, unknown>;

  const primary = await buildQuery(true);
  let data: BookingRow[] = ((primary.data ?? []) as unknown[]).filter(
    (item): item is BookingRow => typeof item === "object" && item !== null,
  );
  let error = primary.error;

  const lowerErrorMessage = error?.message?.toLowerCase() ?? "";
  const isMissingDurationColumns =
    Boolean(error) &&
    (error?.code === "42703" || lowerErrorMessage.includes("booked_hours") || lowerErrorMessage.includes("booked_days"));

  if (isMissingDurationColumns) {
    const fallback = await buildQuery(false);
    data = ((fallback.data ?? []) as unknown[])
      .filter((item): item is BookingRow => typeof item === "object" && item !== null)
      .map((item) => ({
        ...item,
        booked_hours: null,
        booked_days: null,
      }));
    error = fallback.error;
  }

  if (error) {
    return NextResponse.json(
      { success: false, error: `Chargement reservations impossible: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, bookings: data ?? [] });
}
