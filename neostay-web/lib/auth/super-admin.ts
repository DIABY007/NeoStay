import { cookies } from "next/headers";

import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";

export type SuperAdminCheck = {
  ok: boolean;
  status: number;
  error?: string;
  userId?: string;
};

export async function ensureSuperAdmin(): Promise<SuperAdminCheck> {
  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseServiceRoleClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  // OTP custom flow fallback: when no Supabase auth session exists,
  // recover the user id from secure httpOnly cookies set by verify-otp.
  const cookieStore = await cookies();
  const customUserId = cookieStore.get("neostay_user_id")?.value;
  const userId = user?.id ?? customUserId;

  if ((userError && !customUserId) || !userId) {
    return {
      ok: false,
      status: 401,
      error: "Authentification requise.",
    };
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    return {
      ok: false,
      status: 403,
      error: "Profil introuvable.",
    };
  }

  if (profile.role !== "super_admin") {
    return {
      ok: false,
      status: 403,
      error: "Acces reserve au super admin.",
    };
  }

  return {
    ok: true,
    status: 200,
    userId,
  };
}
