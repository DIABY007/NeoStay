import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import {
  getHotelBySlug,
  validateStayDates,
} from "@/lib/bookings/availability";
import { normalizeBurkinaPhone, toWhatsAppPhone } from "@/lib/phone-bf";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ slug: string }> };

const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const ALLOWED_BOOKING_FORMULAS = ["night", "day", "hourly"] as const;
type BookingFormula = (typeof ALLOWED_BOOKING_FORMULAS)[number];

function isBookingFormula(value: string): value is BookingFormula {
  return ALLOWED_BOOKING_FORMULAS.includes(value as BookingFormula);
}

export async function POST(request: Request, { params }: Params) {
  const { slug } = await params;
  const hotel = await getHotelBySlug(slug);

  if (!hotel) {
    return NextResponse.json({ success: false, error: "Hotel introuvable." }, { status: 404 });
  }

  const formData = await request.formData();

  const roomTypeId = String(formData.get("roomTypeId") ?? "").trim();
  const guestName = String(formData.get("guestName") ?? "").trim();
  const guestPhone = normalizeBurkinaPhone(String(formData.get("guestPhone") ?? "").trim());
  const specialRequest = String(formData.get("specialRequest") ?? "").trim();
  const bookingFormulaRaw = String(formData.get("bookingFormula") ?? "night").trim().toLowerCase();
  const bookingHourlyHoursRaw = String(formData.get("bookingHourlyHours") ?? "").trim();
  const bookingHourlyHours = bookingHourlyHoursRaw ? Number(bookingHourlyHoursRaw) : null;
  const bookingDailyDaysRaw = String(formData.get("bookingDailyDays") ?? "").trim();
  const bookingDailyDays = bookingDailyDaysRaw ? Number(bookingDailyDaysRaw) : null;
  const checkIn = String(formData.get("checkIn") ?? "").trim();
  const checkOut = String(formData.get("checkOut") ?? "").trim();
  const paymentProof = formData.get("paymentProof");

  if (!roomTypeId) {
    return NextResponse.json({ success: false, error: "roomTypeId est requis." }, { status: 400 });
  }

  if (guestName.length < 2) {
    return NextResponse.json(
      { success: false, error: "Le nom du client est requis (min 2 caracteres)." },
      { status: 400 },
    );
  }

  if (!guestPhone) {
    return NextResponse.json(
      { success: false, error: "Numero de telephone invalide (format +226XXXXXXXX)." },
      { status: 400 },
    );
  }

  if (!isBookingFormula(bookingFormulaRaw)) {
    return NextResponse.json(
      { success: false, error: "Formule de reservation invalide (jour, nuit, horaire)." },
      { status: 400 },
    );
  }

  if (bookingFormulaRaw === "hourly") {
    if (!Number.isInteger(bookingHourlyHours) || bookingHourlyHours === null || bookingHourlyHours < 1 || bookingHourlyHours > 24) {
      return NextResponse.json(
        { success: false, error: "Duree horaire invalide (1 a 24 heures)." },
        { status: 400 },
      );
    }
  }

  if (bookingFormulaRaw === "day") {
    if (bookingDailyDays !== null && (!Number.isInteger(bookingDailyDays) || bookingDailyDays < 1 || bookingDailyDays > 30)) {
      return NextResponse.json(
        { success: false, error: "Duree journaliere invalide (1 a 30 jours)." },
        { status: 400 },
      );
    }
  }

  try {
    validateStayDates(checkIn, checkOut);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Dates invalides." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServiceRoleClient();

  const { data: roomType, error: roomTypeError } = await supabase
    .from("room_types")
    .select("id, name")
    .eq("id", roomTypeId)
    .eq("hotel_id", hotel.id)
    .maybeSingle();

  if (roomTypeError || !roomType) {
    return NextResponse.json(
      { success: false, error: "Type de chambre introuvable pour cet hotel." },
      { status: 404 },
    );
  }

  let booking: { id: string; status: string; expires_at: string } | null = null;
  let paymentProofWarning: string | null = null;
  const specialRequestWithFormulaFallback =
    bookingFormulaRaw === "hourly" && bookingHourlyHours !== null
      ? `${specialRequest ? `${specialRequest}\n` : ""}Formule horaire choisie: ${bookingHourlyHours}h`
      : bookingFormulaRaw === "day" && bookingDailyDays !== null
        ? `${specialRequest ? `${specialRequest}\n` : ""}Formule journaliere choisie: ${bookingDailyDays}j`
        : specialRequest;

  const { data: atomicResult, error: atomicError } = await (async () => {
    const newSignatureCall = await supabase.rpc("create_pending_booking_atomic", {
      p_hotel_id: hotel.id,
      p_room_type_id: roomTypeId,
      p_guest_name: guestName,
      p_guest_phone: guestPhone,
      p_special_request: specialRequest || "",
      p_check_in: checkIn,
      p_check_out: checkOut,
      p_payment_proof_path: null,
      p_booking_formula: bookingFormulaRaw,
      p_booking_hourly_hours: bookingFormulaRaw === "hourly" ? bookingHourlyHours : null,
      p_booking_daily_days: bookingFormulaRaw === "day" ? bookingDailyDays : null,
    });

    if (!newSignatureCall.error) {
      return newSignatureCall;
    }

    const message = newSignatureCall.error.message ?? "";
    const missingDailyParamInSchema =
      message.includes("Could not find the function public.create_pending_booking_atomic") &&
      message.includes("p_booking_daily_days");

    if (missingDailyParamInSchema) {
      const hourlySignatureCall = await supabase.rpc("create_pending_booking_atomic", {
        p_hotel_id: hotel.id,
        p_room_type_id: roomTypeId,
        p_guest_name: guestName,
        p_guest_phone: guestPhone,
        p_special_request: specialRequestWithFormulaFallback || "",
        p_check_in: checkIn,
        p_check_out: checkOut,
        p_payment_proof_path: null,
        p_booking_formula: bookingFormulaRaw,
        p_booking_hourly_hours: bookingFormulaRaw === "hourly" ? bookingHourlyHours : null,
      });

      if (!hourlySignatureCall.error) {
        return hourlySignatureCall;
      }
    }

    const missingHourlyParamInSchema =
      message.includes("Could not find the function public.create_pending_booking_atomic") &&
      message.includes("p_booking_hourly_hours");

    if (!missingHourlyParamInSchema && !missingDailyParamInSchema) {
      return newSignatureCall;
    }

    // Backward-compat with old function signature while DB migration/cache is catching up.
    return supabase.rpc("create_pending_booking_atomic", {
      p_hotel_id: hotel.id,
      p_room_type_id: roomTypeId,
      p_guest_name: guestName,
      p_guest_phone: guestPhone,
      p_special_request: specialRequestWithFormulaFallback || "",
      p_check_in: checkIn,
      p_check_out: checkOut,
      p_payment_proof_path: null,
      p_booking_formula: bookingFormulaRaw,
    });
  })();

  if (atomicError) {
    const message = atomicError.message;

    if (message.includes("NO_AVAILABILITY")) {
      return NextResponse.json(
        { success: false, error: "Cette chambre est indisponible pour les dates selectionnees." },
        { status: 409 },
      );
    }

    if (message.includes("ROOM_TYPE_NOT_FOUND")) {
      return NextResponse.json(
        { success: false, error: "Type de chambre introuvable pour cet hotel." },
        { status: 404 },
      );
    }

    if (message.includes("INVALID_STAY_DATES")) {
      return NextResponse.json({ success: false, error: "Dates de sejour invalides." }, { status: 400 });
    }

    if (message.includes("INVALID_BOOKING_FORMULA")) {
      return NextResponse.json(
        { success: false, error: "Formule de reservation invalide." },
        { status: 400 },
      );
    }

    if (message.includes("INVALID_BOOKING_HOURLY_HOURS")) {
      return NextResponse.json(
        { success: false, error: "Duree horaire invalide pour la formule choisie." },
        { status: 400 },
      );
    }

    if (message.includes("INVALID_BOOKING_DAILY_DAYS")) {
      return NextResponse.json(
        { success: false, error: "Duree journaliere invalide pour la formule choisie." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { success: false, error: `Creation reservation impossible: ${message}` },
      { status: 500 },
    );
  }

  const atomicBooking = Array.isArray(atomicResult) ? atomicResult[0] : null;
  if (!atomicBooking?.id) {
    return NextResponse.json(
      { success: false, error: "Creation reservation impossible." },
      { status: 500 },
    );
  }

  booking = {
    id: atomicBooking.id,
    status: atomicBooking.status,
    expires_at: atomicBooking.expires_at,
  };

  if (paymentProof instanceof File && paymentProof.size > 0) {
    if (!ACCEPTED_TYPES.includes(paymentProof.type)) {
      return NextResponse.json(
        { success: false, error: "Format preuve invalide. Formats acceptes: jpg, png, pdf." },
        { status: 400 },
      );
    }

    if (paymentProof.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json(
        { success: false, error: "Fichier trop volumineux. Maximum 5 Mo." },
        { status: 400 },
      );
    }

    const fileExt = paymentProof.name.split(".").pop()?.toLowerCase() ?? "bin";
    const filePath = `${hotel.id}/${roomTypeId}/${booking.id}-${Date.now()}-${randomUUID()}.${fileExt}`;
    const fileBuffer = Buffer.from(await paymentProof.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("payment-proofs")
      .upload(filePath, fileBuffer, {
        contentType: paymentProof.type,
        upsert: false,
      });

    if (uploadError) {
      paymentProofWarning = `Reservation creee, mais upload preuve impossible: ${uploadError.message}`;
    } else {
      const { error: bookingUpdateError } = await supabase
        .from("bookings")
        .update({ payment_proof_path: filePath })
        .eq("id", booking.id)
        .eq("hotel_id", hotel.id);

      if (bookingUpdateError) {
        paymentProofWarning = `Reservation creee, mais liaison preuve impossible: ${bookingUpdateError.message}`;
      }
    }
  }

  const roomTypeName = roomType.name;
  const formulaLabel =
    bookingFormulaRaw === "day"
      ? bookingDailyDays
        ? `Jour (${bookingDailyDays}j)`
        : "Jour"
      : bookingFormulaRaw === "hourly"
        ? `Horaire (${bookingHourlyHours}h)`
        : "Nuit";
  const whatsappText = [
    "Bonjour, je viens de faire une demande de reservation NeoStay.",
    `Reference: ${booking.id}`,
    `Hotel: ${hotel.name}`,
    `Chambre: ${roomTypeName}`,
    `Formule: ${formulaLabel}`,
    `Check-in: ${checkIn}`,
    `Check-out: ${checkOut}`,
    `Client: ${guestName}`,
    `Telephone: ${guestPhone}`,
  ].join("\n");

  const whatsappUrl = `https://wa.me/${toWhatsAppPhone(hotel.whatsapp_number)}?text=${encodeURIComponent(whatsappText)}`;

  return NextResponse.json(
    {
      success: true,
      booking,
      message: "Reservation enregistree en attente de confirmation.",
      whatsappUrl,
      paymentProofWarning,
    },
    { status: 201 },
  );
}
