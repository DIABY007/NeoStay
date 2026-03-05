import { NextResponse } from "next/server";

import { ensureHotelAdminForSlug } from "@/lib/auth/hotel-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ hotelSlug: string }> };

type UpdateHotelSettingsBody = {
  description?: string;
  themeColor?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  themeTemplate?: "classic" | "modern";
  logoUrl?: string;
  mapEmbedHtml?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

function isHexColor(value: string) {
  return /^#([0-9a-fA-F]{6})$/.test(value);
}

function extractIframeSrc(input: string) {
  const iframeSrcMatch = input.match(/<iframe[^>]*\ssrc=["']([^"']+)["'][^>]*>/i);
  return iframeSrcMatch?.[1]?.trim() ?? null;
}

function isAllowedGoogleMapsUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const isGoogleHost = host === "www.google.com" || host === "google.com" || host === "maps.google.com";
    const isMapsPath = url.pathname.startsWith("/maps") || url.pathname.startsWith("/maps/embed");
    return url.protocol === "https:" && isGoogleHost && isMapsPath;
  } catch {
    return false;
  }
}

function normalizeGoogleMapsEmbedInput(input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const candidate = trimmed.includes("<iframe") ? extractIframeSrc(trimmed) : trimmed;
  if (!candidate || !isAllowedGoogleMapsUrl(candidate)) {
    return null;
  }

  return candidate;
}

export async function GET(_: Request, { params }: Params) {
  const { hotelSlug } = await params;
  const auth = await ensureHotelAdminForSlug(hotelSlug);

  if (!auth.ok || !auth.hotelId) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("hotels")
    .select(
      "id, name, slug, description, theme_color, hero_title, hero_subtitle, theme_template, logo_url, map_embed_html, latitude, longitude",
    )
    .eq("id", auth.hotelId)
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, error: `Chargement settings impossible: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, hotel: data });
}

export async function PATCH(request: Request, { params }: Params) {
  const { hotelSlug } = await params;
  const auth = await ensureHotelAdminForSlug(hotelSlug);

  if (!auth.ok || !auth.hotelId) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as UpdateHotelSettingsBody;

  const payload: {
    description?: string | null;
    theme_color?: string;
    hero_title?: string | null;
    hero_subtitle?: string | null;
    theme_template?: "classic" | "modern";
    logo_url?: string | null;
    map_embed_html?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } = {};

  if (body.description !== undefined) {
    payload.description = body.description.trim() || null;
  }

  if (body.themeColor !== undefined) {
    const themeColor = body.themeColor.trim();
    if (!isHexColor(themeColor)) {
      return NextResponse.json(
        { success: false, error: "Couleur invalide (format #RRGGBB)." },
        { status: 400 },
      );
    }
    payload.theme_color = themeColor;
  }

  if (body.heroTitle !== undefined) {
    payload.hero_title = body.heroTitle.trim() || null;
  }

  if (body.heroSubtitle !== undefined) {
    payload.hero_subtitle = body.heroSubtitle.trim() || null;
  }

  if (body.themeTemplate !== undefined) {
    if (body.themeTemplate !== "classic" && body.themeTemplate !== "modern") {
      return NextResponse.json(
        { success: false, error: "Template invalide (classic|modern)." },
        { status: 400 },
      );
    }
    payload.theme_template = body.themeTemplate;
  }

  if (body.logoUrl !== undefined) {
    const logoUrl = body.logoUrl.trim();
    payload.logo_url = logoUrl || null;
  }

  if (body.mapEmbedHtml !== undefined) {
    if (body.mapEmbedHtml === null || body.mapEmbedHtml.trim() === "") {
      payload.map_embed_html = null;
    } else {
      if (body.mapEmbedHtml.length > 8000) {
        return NextResponse.json(
          { success: false, error: "Le code de la carte est trop long." },
          { status: 400 },
        );
      }

      const normalizedMapUrl = normalizeGoogleMapsEmbedInput(body.mapEmbedHtml);
      if (!normalizedMapUrl) {
        return NextResponse.json(
          {
            success: false,
            error: "Code Google Maps invalide. Collez un iframe Google Maps ou une URL https://www.google.com/maps/...",
          },
          { status: 400 },
        );
      }

      payload.map_embed_html = normalizedMapUrl;
    }
  }

  if (body.latitude !== undefined) {
    if (body.latitude !== null) {
      if (!Number.isFinite(body.latitude) || body.latitude < -90 || body.latitude > 90) {
        return NextResponse.json(
          { success: false, error: "Latitude invalide (entre -90 et 90)." },
          { status: 400 },
        );
      }
      payload.latitude = body.latitude;
    } else {
      payload.latitude = null;
    }
  }

  if (body.longitude !== undefined) {
    if (body.longitude !== null) {
      if (!Number.isFinite(body.longitude) || body.longitude < -180 || body.longitude > 180) {
        return NextResponse.json(
          { success: false, error: "Longitude invalide (entre -180 et 180)." },
          { status: 400 },
        );
      }
      payload.longitude = body.longitude;
    } else {
      payload.longitude = null;
    }
  }

  if (
    (payload.latitude !== undefined || payload.longitude !== undefined)
    && !(
      (payload.latitude === undefined && payload.longitude === undefined)
      || (payload.latitude === null && payload.longitude === null)
      || (typeof payload.latitude === "number" && typeof payload.longitude === "number")
    )
  ) {
    return NextResponse.json(
      { success: false, error: "Latitude et longitude doivent etre renseignees ensemble." },
      { status: 400 },
    );
  }

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ success: false, error: "Aucun champ a modifier." }, { status: 400 });
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("hotels")
    .update(payload)
    .eq("id", auth.hotelId)
    .select(
      "id, name, slug, description, theme_color, hero_title, hero_subtitle, theme_template, logo_url, map_embed_html, latitude, longitude",
    )
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, error: `Mise a jour settings impossible: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, hotel: data });
}
