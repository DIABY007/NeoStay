import { NextResponse } from "next/server";

import { ensureSuperAdmin } from "@/lib/auth/super-admin";
import { normalizeBurkinaPhone } from "@/lib/phone-bf";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

type CreateHotelBody = {
  name?: string;
  slug?: string;
  whatsappNumber?: string;
};

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET() {
  const auth = await ensureSuperAdmin();

  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("hotels")
    .select("id, name, slug, whatsapp_number, status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { success: false, error: `Impossible de charger les hotels: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, hotels: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await ensureSuperAdmin();

  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as CreateHotelBody;

  const name = body.name?.trim() ?? "";
  const rawSlug = body.slug?.trim() ?? "";
  const slug = normalizeSlug(rawSlug);
  const whatsappNumber = normalizeBurkinaPhone(body.whatsappNumber?.trim() ?? "");

  if (!name || name.length < 2) {
    return NextResponse.json(
      { success: false, error: "Le nom de l'hotel est requis (min 2 caracteres)." },
      { status: 400 },
    );
  }

  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return NextResponse.json(
      { success: false, error: "Slug invalide. Utilisez lettres minuscules, chiffres et tirets." },
      { status: 400 },
    );
  }

  if (!whatsappNumber) {
    return NextResponse.json(
      { success: false, error: "Numero WhatsApp invalide (format +226XXXXXXXX)." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("hotels")
    .insert({
      name,
      slug,
      whatsapp_number: whatsappNumber,
      status: "active",
    })
    .select("id, name, slug, whatsapp_number, status, created_at")
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, error: `Creation hotel impossible: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, hotel: data }, { status: 201 });
}
