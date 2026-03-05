import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { OTP_STATE_COOKIE, verifyOtpStateToken } from "@/lib/otp";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const code = String(body?.code ?? "")
      .replace(/\D/g, "")
      .trim();

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { success: false, error: "Code OTP invalide (6 chiffres requis)" },
        { status: 400 },
      );
    }

    // Lire le cookie OTP signé
    const otpState = request.cookies.get(OTP_STATE_COOKIE)?.value;
    if (!otpState) {
      return NextResponse.json(
        { success: false, error: "Session OTP invalide. Veuillez recommencer." },
        { status: 401 },
      );
    }

    // Vérifier la signature HMAC et l'expiration
    const otpCheck = verifyOtpStateToken(otpState, code);
    if (!otpCheck.valid || !otpCheck.phone) {
      return NextResponse.json(
        { success: false, error: otpCheck.reason || "Vérification OTP échouée" },
        { status: 401 },
      );
    }

    // Récupérer le profil depuis public.profiles
    const supabase = createSupabaseServiceRoleClient();
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, phone_number, role, hotel_id")
      .eq("phone_number", otpCheck.phone)
      .maybeSingle();

    if (profileError || !profile) {
      console.error("[VERIFY-OTP] Profil introuvable:", profileError);
      return NextResponse.json(
        { success: false, error: "Utilisateur non trouvé. Vérifiez votre numéro." },
        { status: 404 },
      );
    }

    // Poser les cookies de session (httpOnly)
    const cookieStore = await cookies();
    const sessionToken = Buffer.from(`${profile.id}:${Date.now()}`).toString("base64");

    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 60 * 60 * 24 * 7, // 7 jours
    };

    cookieStore.set("neostay_session", sessionToken, cookieOpts);
    cookieStore.set("neostay_user_id", profile.id, cookieOpts);

    // Supprimer le cookie OTP utilisé
    cookieStore.delete(OTP_STATE_COOKIE);

    return NextResponse.json({
      success: true,
      user: {
        id: profile.id,
        phone: profile.phone_number,
        role: profile.role,
        hotelId: profile.hotel_id,
      },
    });
  } catch (error) {
    console.error("[VERIFY-OTP] Erreur:", error);
    return NextResponse.json(
      { success: false, error: "Erreur serveur" },
      { status: 500 },
    );
  }
}
