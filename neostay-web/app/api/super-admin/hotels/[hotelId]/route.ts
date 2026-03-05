import { NextResponse } from "next/server";

import { ensureSuperAdmin } from "@/lib/auth/super-admin";
import { normalizeBurkinaPhone } from "@/lib/phone-bf";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

type UpdateHotelBody = {
  name?: string;
  slug?: string;
  whatsappNumber?: string;
  status?: "active" | "paused";
};

type RouteContext = {
  params: Promise<{ hotelId: string }>;
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

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await ensureSuperAdmin();

  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const { hotelId } = await context.params;
  if (!hotelId) {
    return NextResponse.json({ success: false, error: "hotelId manquant." }, { status: 400 });
  }

  const body = (await request.json()) as UpdateHotelBody;
  const updates: {
    name?: string;
    slug?: string;
    whatsapp_number?: string;
    status?: "active" | "paused";
  } = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name || name.length < 2) {
      return NextResponse.json(
        { success: false, error: "Le nom de l'hotel est requis (min 2 caracteres)." },
        { status: 400 },
      );
    }
    updates.name = name;
  }

  if (typeof body.slug === "string") {
    const slug = normalizeSlug(body.slug);
    if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return NextResponse.json(
        {
          success: false,
          error: "Slug invalide. Utilisez lettres minuscules, chiffres et tirets.",
        },
        { status: 400 },
      );
    }
    updates.slug = slug;
  }

  if (typeof body.whatsappNumber === "string") {
    const whatsappNumber = normalizeBurkinaPhone(body.whatsappNumber);
    if (!whatsappNumber) {
      return NextResponse.json(
        { success: false, error: "Numero WhatsApp invalide (format +226XXXXXXXX)." },
        { status: 400 },
      );
    }
    updates.whatsapp_number = whatsappNumber;
  }

  if (typeof body.status === "string") {
    if (body.status !== "active" && body.status !== "paused") {
      return NextResponse.json(
        { success: false, error: "Status invalide. Valeurs autorisees: active, paused." },
        { status: 400 },
      );
    }
    updates.status = body.status;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { success: false, error: "Aucune donnee a modifier." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("hotels")
    .update(updates)
    .eq("id", hotelId)
    .select("id, name, slug, whatsapp_number, status, created_at")
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, error: `Modification hotel impossible: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, hotel: data });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await ensureSuperAdmin();

  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const { hotelId } = await context.params;
  if (!hotelId) {
    return NextResponse.json({ success: false, error: "hotelId manquant." }, { status: 400 });
  }

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.from("hotels").delete().eq("id", hotelId);

  if (error) {
    return NextResponse.json(
      { success: false, error: `Suppression hotel impossible: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}