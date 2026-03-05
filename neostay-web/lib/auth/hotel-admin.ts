import { cookies } from "next/headers";

import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";

export type HotelAdminCheck = {
  ok: boolean;
  status: number;
  error?: string;
  userId?: string;
  hotelId?: string;
  hotelSlug?: string;
};

export async function ensureHotelAdminForSlug(
  expectedSlug: string,
): Promise<HotelAdminCheck> {
  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseServiceRoleClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  const cookieStore = await cookies();
  const customUserId = cookieStore.get("neostay_user_id")?.value;
  const userId = user?.id ?? customUserId;

  if ((userError && !customUserId) || !userId) {
    return { ok: false, status: 401, error: "Authentification requise." };
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role, hotel_id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    return { ok: false, status: 403, error: "Profil introuvable." };
  }

  if (profile.role !== "hotel_admin") {
    return { ok: false, status: 403, error: "Acces reserve aux admins hotel." };
  }

  if (!profile.hotel_id) {
    return { ok: false, status: 403, error: "Aucun hotel assigne a ce compte." };
  }

  const { data: hotel, error: hotelError } = await adminClient
    .from("hotels")
    .select("id, slug")
    .eq("id", profile.hotel_id)
    .maybeSingle();

  if (hotelError || !hotel) {
    return { ok: false, status: 404, error: "Hotel admin introuvable." };
  }

  if (hotel.slug !== expectedSlug) {
    return { ok: false, status: 403, error: "Acces refuse pour ce slug hotel." };
  }

  return {
    ok: true,
    status: 200,
    userId,
    hotelId: hotel.id,
    hotelSlug: hotel.slug,
  };
}
