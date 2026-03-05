import { NextResponse } from "next/server";

import { ensureSuperAdmin } from "@/lib/auth/super-admin";
import { normalizeBurkinaPhone } from "@/lib/phone-bf";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

type AssignHotelAdminBody = {
  phoneNumber?: string;
  hotelId?: string;
};

async function findAuthUserByPhone(phone: string) {
  const supabase = createSupabaseServiceRoleClient();

  // Prefer application profile lookup instead of auth.admin.listUsers(),
  // which can fail with provider-level "Database error finding users".
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("phone_number", phone)
    .maybeSingle();

  if (error || !profile) {
    return null;
  }

  return { id: profile.id, phone };
}

export async function POST(request: Request) {
  const auth = await ensureSuperAdmin();

  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as AssignHotelAdminBody;

  const phoneNumber = normalizeBurkinaPhone(body.phoneNumber ?? "");
  const hotelId = body.hotelId?.trim() ?? "";

  if (!phoneNumber) {
    return NextResponse.json(
      { success: false, error: "Numero de telephone invalide (format +226XXXXXXXX)." },
      { status: 400 },
    );
  }

  if (!hotelId) {
    return NextResponse.json(
      { success: false, error: "hotelId est obligatoire." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data: hotel, error: hotelError } = await supabase
    .from("hotels")
    .select("id, slug, name")
    .eq("id", hotelId)
    .maybeSingle();

  if (hotelError || !hotel) {
    return NextResponse.json(
      { success: false, error: "Hotel introuvable." },
      { status: 404 },
    );
  }

  let userId: string | null = null;

  // Create first. If the phone already exists, fallback to existing profile id.
  const createResult = await supabase.auth.admin.createUser({
    phone: phoneNumber,
    phone_confirm: true,
    user_metadata: {
      source: "super_admin_assignment",
    },
  });

  if (createResult.error || !createResult.data.user) {
    const existing = await findAuthUserByPhone(phoneNumber);
    if (!existing?.id) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Impossible de creer l'utilisateur auth: ${createResult.error?.message ?? "unknown"}. ` +
            "Aucun profil existant trouve pour ce numero.",
        },
        { status: 500 },
      );
    }
    userId = existing.id;
  } else {
    userId = createResult.data.user.id;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: userId,
        phone_number: phoneNumber,
        role: "hotel_admin",
        hotel_id: hotelId,
      },
      { onConflict: "id" },
    )
    .select("id, phone_number, role, hotel_id")
    .single();

  if (profileError) {
    return NextResponse.json(
      { success: false, error: `Echec assignation admin: ${profileError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    admin: profile,
    hotel,
  });
}
