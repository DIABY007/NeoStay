import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import { ensureHotelAdminForSlug } from "@/lib/auth/hotel-admin";
import { ensureHotelOperatorForSlug } from "@/lib/auth/hotel-operator";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ hotelSlug: string; bookingId: string }> };

const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "application/pdf"];

function guessContentTypeFromPath(path: string | null) {
  if (!path) {
    return null;
  }

  const ext = path.split(".").pop()?.toLowerCase();

  if (ext === "jpg" || ext === "jpeg") {
    return "image/jpeg";
  }

  if (ext === "png") {
    return "image/png";
  }

  if (ext === "pdf") {
    return "application/pdf";
  }

  return null;
}

export async function GET(_request: Request, { params }: Params) {
  const { hotelSlug, bookingId } = await params;
  const auth = await ensureHotelOperatorForSlug(hotelSlug);

  if (!auth.ok || !auth.hotelId) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const supabase = createSupabaseServiceRoleClient();

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select(
      "id, guest_name, guest_phone, special_request, booking_formula, booked_hours, booked_days, check_in_date, check_out_date, status, payment_proof_path, expires_at, created_at, room_types(name)",
    )
    .eq("id", bookingId)
    .eq("hotel_id", auth.hotelId)
    .maybeSingle();

  if (bookingError || !booking) {
    return NextResponse.json({ success: false, error: "Reservation introuvable." }, { status: 404 });
  }

  const proofPath = booking.payment_proof_path;
  const proofFileName = proofPath ? proofPath.split("/").pop() ?? null : null;
  const proofContentType = guessContentTypeFromPath(proofPath);

  if (!proofPath) {
    return NextResponse.json({
      success: true,
      booking,
      proofSignedUrl: null,
      proofFileName,
      proofContentType,
    });
  }

  const { data: signedData, error: signedError } = await supabase.storage
    .from("payment-proofs")
    .createSignedUrl(proofPath, 60 * 30);

  if (signedError || !signedData?.signedUrl) {
    return NextResponse.json({
      success: true,
      booking,
      proofSignedUrl: null,
      proofFileName,
      proofContentType,
      proofError: signedError?.message ?? "La preuve existe mais son URL n'a pas pu etre generee.",
    });
  }

  return NextResponse.json({
    success: true,
    booking,
    proofSignedUrl: signedData.signedUrl,
    proofFileName,
    proofContentType,
  });
}

export async function POST(request: Request, { params }: Params) {
  const { hotelSlug, bookingId } = await params;
  const auth = await ensureHotelAdminForSlug(hotelSlug);

  if (!auth.ok || !auth.hotelId) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const formData = await request.formData();
  const paymentProof = formData.get("paymentProof");

  if (!(paymentProof instanceof File) || paymentProof.size === 0) {
    return NextResponse.json(
      { success: false, error: "Fichier preuve requis." },
      { status: 400 },
    );
  }

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

  const supabase = createSupabaseServiceRoleClient();

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, room_type_id, status")
    .eq("id", bookingId)
    .eq("hotel_id", auth.hotelId)
    .maybeSingle();

  if (bookingError || !booking) {
    return NextResponse.json({ success: false, error: "Reservation introuvable." }, { status: 404 });
  }

  if (booking.status !== "pending") {
    return NextResponse.json(
      { success: false, error: "Seules les reservations pending peuvent recevoir une preuve." },
      { status: 400 },
    );
  }

  const fileExt = paymentProof.name.split(".").pop()?.toLowerCase() ?? "bin";
  const filePath = `${auth.hotelId}/${booking.room_type_id}/${Date.now()}-${randomUUID()}.${fileExt}`;
  const fileBuffer = Buffer.from(await paymentProof.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("payment-proofs")
    .upload(filePath, fileBuffer, {
      contentType: paymentProof.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { success: false, error: `Upload preuve impossible: ${uploadError.message}` },
      { status: 500 },
    );
  }

  const { data: updatedBooking, error: updateError } = await supabase
    .from("bookings")
    .update({ payment_proof_path: filePath })
    .eq("id", booking.id)
    .eq("hotel_id", auth.hotelId)
    .select("id, payment_proof_path")
    .single();

  if (updateError) {
    return NextResponse.json(
      { success: false, error: `Mise a jour reservation impossible: ${updateError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, booking: updatedBooking });
}
