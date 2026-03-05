import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { createOtpStateToken, generateOtpCode, OTP_STATE_COOKIE, OTP_TTL_MS } from "@/lib/otp";
import { normalizeBurkinaPhone } from "@/lib/phone-bf";
import { sendOtpWhatsApp } from "@/lib/wasender";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawPhone: unknown = body?.phone;

    if (typeof rawPhone !== "string" || !rawPhone) {
      return NextResponse.json(
        { success: false, error: "Numéro de téléphone requis" },
        { status: 400 },
      );
    }

    const phone = normalizeBurkinaPhone(rawPhone);

    if (!phone) {
      return NextResponse.json(
        { success: false, error: "Format de telephone invalide (Burkina Faso: +226XXXXXXXX)." },
        { status: 400 },
      );
    }

    // Vérifier que ce numéro correspond à un profil connu
    const supabase = createSupabaseServiceRoleClient();
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone_number", phone)
      .maybeSingle();

    if (profileError) {
      console.error("[SEND-OTP] Erreur Supabase:", profileError);
      return NextResponse.json(
        { success: false, error: "Erreur lors de la vérification du compte" },
        { status: 500 },
      );
    }

    if (!profile) {
      return NextResponse.json(
        { success: false, error: "Aucun compte trouvé pour ce numéro" },
        { status: 404 },
      );
    }

    // Générer le code et l'envoyer via WasenderAPI
    const code = generateOtpCode();
    const sendResult = await sendOtpWhatsApp(phone, code);

    if (!sendResult.success) {
      console.error("[SEND-OTP] Erreur WasenderAPI:", sendResult.error);
      return NextResponse.json(
        { success: false, error: sendResult.error || "Échec de l'envoi WhatsApp" },
        { status: 500 },
      );
    }

    // Stocker le code signé dans un cookie httpOnly (jamais exposé au client)
    const otpToken = createOtpStateToken(phone, code);
    const response = NextResponse.json({
      success: true,
      message: "Code OTP envoyé sur WhatsApp",
      phone,
    });

    response.cookies.set(OTP_STATE_COOKIE, otpToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(OTP_TTL_MS / 1000),
    });

    return response;
  } catch (error) {
    console.error("[SEND-OTP] Erreur:", error);
    return NextResponse.json(
      { success: false, error: "Erreur serveur" },
      { status: 500 },
    );
  }
}
