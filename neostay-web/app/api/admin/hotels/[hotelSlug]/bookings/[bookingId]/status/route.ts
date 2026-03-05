import { NextResponse } from "next/server";

import { ensureHotelOperatorForSlug } from "@/lib/auth/hotel-operator";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ hotelSlug: string; bookingId: string }> };

type UpdateBookingStatusBody = {
  status?: "confirmed" | "cancelled";
  rejectionReason?: string;
};

function toWhatsAppPhone(value: string) {
  return value.replace(/[^\d]/g, "");
}

function formulaLabel(formula: string, bookedHours: number | null, bookedDays: number | null) {
  if (formula === "hourly") {
    return bookedHours ? `Horaire (${bookedHours}h)` : "Horaire";
  }

  if (formula === "day") {
    return bookedDays ? `Jour (${bookedDays}j)` : "Jour";
  }

  return "Nuit";
}

export async function PATCH(request: Request, { params }: Params) {
  const { hotelSlug, bookingId } = await params;
  const auth = await ensureHotelOperatorForSlug(hotelSlug);

  if (!auth.ok || !auth.hotelId) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as UpdateBookingStatusBody;
  const nextStatus = body.status;
  const rejectionReason = body.rejectionReason?.trim() ?? "";

  if (nextStatus !== "confirmed" && nextStatus !== "cancelled") {
    return NextResponse.json(
      { success: false, error: "Status invalide. Valeurs autorisees: confirmed|cancelled." },
      { status: 400 },
    );
  }

  if (nextStatus === "cancelled" && rejectionReason.length < 3) {
    return NextResponse.json(
      { success: false, error: "Le motif de refus est requis (min 3 caracteres)." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select(
      "id, status, guest_name, guest_phone, check_in_date, check_out_date, booking_formula, room_types(name), hotels(name, whatsapp_number)",
    )
    .eq("id", bookingId)
    .eq("hotel_id", auth.hotelId)
    .maybeSingle();

  if (bookingError || !booking) {
    return NextResponse.json({ success: false, error: "Reservation introuvable." }, { status: 404 });
  }

  if (booking.status === "expired") {
    return NextResponse.json(
      { success: false, error: "Une reservation expiree ne peut plus etre modifiee." },
      { status: 400 },
    );
  }

  let { data: updated, error: updateError } = await supabase
    .from("bookings")
    .update({
      status: nextStatus,
      rejection_reason: nextStatus === "cancelled" ? rejectionReason : null,
    })
    .eq("id", booking.id)
    .eq("hotel_id", auth.hotelId)
    .select(
      "id, status, guest_name, guest_phone, check_in_date, check_out_date, booking_formula, room_types(name), hotels(name, whatsapp_number)",
    )
    .single();

  const missingRejectionReasonColumn =
    Boolean(updateError) &&
    (updateError?.code === "42703" || updateError?.message?.toLowerCase().includes("rejection_reason"));

  if (missingRejectionReasonColumn) {
    const fallbackUpdate = await supabase
      .from("bookings")
      .update({ status: nextStatus })
      .eq("id", booking.id)
      .eq("hotel_id", auth.hotelId)
      .select(
        "id, status, guest_name, guest_phone, check_in_date, check_out_date, booking_formula, room_types(name), hotels(name, whatsapp_number)",
      )
      .single();

    updated = fallbackUpdate.data;
    updateError = fallbackUpdate.error;
  }

  if (updateError) {
    return NextResponse.json(
      { success: false, error: `Mise a jour status impossible: ${updateError.message}` },
      { status: 500 },
    );
  }

  if (!updated) {
    return NextResponse.json(
      { success: false, error: "Reservation introuvable apres mise a jour." },
      { status: 500 },
    );
  }

  const roomTypeData = Array.isArray(updated.room_types) ? updated.room_types[0] : updated.room_types;
  const hotelData = Array.isArray(updated.hotels) ? updated.hotels[0] : updated.hotels;

  const guestName = updated.guest_name;
  const roomName = roomTypeData?.name ?? "votre chambre";
  const hotelName = hotelData?.name ?? "votre hotel";
  const hotelWhatsapp = hotelData?.whatsapp_number;
  const formula = formulaLabel(updated.booking_formula, null, null);

  const messageLines =
    nextStatus === "confirmed"
      ? [
          `Bonjour ${guestName},`,
          `Votre reservation ${updated.id} a ete validee.`,
          `Hotel: ${hotelName}`,
          `Chambre: ${roomName}`,
          `Formule: ${formula}`,
          `Check-in: ${updated.check_in_date}`,
          `Check-out: ${updated.check_out_date}`,
          "Merci pour votre confiance.",
        ]
      : [
          `Bonjour ${guestName},`,
          `Votre reservation ${updated.id} n'a pas pu etre validee.`,
          `Motif: ${rejectionReason}`,
          `Hotel: ${hotelName}`,
          `Chambre: ${roomName}`,
          `Formule: ${formula}`,
        ];

  const customerWhatsappUrl = `https://wa.me/${toWhatsAppPhone(updated.guest_phone)}?text=${encodeURIComponent(
    messageLines.join("\n"),
  )}`;
  const hotelWhatsappUrl = hotelWhatsapp
    ? `https://wa.me/${toWhatsAppPhone(hotelWhatsapp)}?text=${encodeURIComponent(messageLines.join("\n"))}`
    : null;

  return NextResponse.json({
    success: true,
    booking: updated,
    whatsappUrl: customerWhatsappUrl,
    hotelWhatsappUrl,
  });
}
