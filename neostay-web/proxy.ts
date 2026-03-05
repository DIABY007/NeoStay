import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function redirectWithCookies(
  request: NextRequest,
  response: NextResponse,
  pathname: string,
) {
  const redirectResponse = NextResponse.redirect(new URL(pathname, request.url));

  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });

  return redirectResponse;
}

function isProtectedRoute(pathname: string) {
  return pathname.startsWith("/super-admin") || pathname.startsWith("/admin");
}

async function getProfileFromCustomCookies(
  request: NextRequest,
): Promise<{ role: string; hotel_id: string | null } | null> {
  const userId = request.cookies.get("neostay_user_id")?.value;
  const session = request.cookies.get("neostay_session")?.value;

  if (!userId || !session || !UUID_REGEX.test(userId)) return null;

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=role,hotel_id&limit=1`,
    {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
    },
  );

  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{ role: string; hotel_id: string | null }>;
  return rows[0] ?? null;
}

export async function proxy(request: NextRequest) {
  const { supabase, response } = createSupabaseMiddlewareClient(request);
  const pathname = request.nextUrl.pathname;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Fallback : cookies custom posés par /api/auth/verify-otp (WasenderAPI flow)
    if (isProtectedRoute(pathname)) {
      const customProfile = await getProfileFromCustomCookies(request);
      if (!customProfile) {
        return redirectWithCookies(request, response, "/login");
      }
      // Injecter le profil pour la suite de la logique
      const fakeProfile = customProfile;
      return handleRouting(request, response, pathname, fakeProfile, null);
    }

    return response;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, hotel_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return redirectWithCookies(request, response, "/login");
  }

  let hotelSlug: string | null = null;

  if (profile.hotel_id) {
    const { data: hotel } = await supabase
      .from("hotels")
      .select("slug")
      .eq("id", profile.hotel_id)
      .maybeSingle();

    hotelSlug = hotel?.slug ?? null;
  }

  return handleRouting(request, response, pathname, profile, hotelSlug);
}

async function handleRouting(
  request: NextRequest,
  response: NextResponse,
  pathname: string,
  profile: { role: string; hotel_id: string | null },
  hotelSlug: string | null,
): Promise<NextResponse> {
  // Pour le flow WasenderAPI (pas de session Supabase), récupérer le slug depuis la DB
  if (hotelSlug === null && profile.hotel_id) {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/hotels?id=eq.${profile.hotel_id}&select=slug&limit=1`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        },
      },
    );
    if (res.ok) {
      const rows = (await res.json()) as Array<{ slug: string }>;
      hotelSlug = rows[0]?.slug ?? null;
    }
  }

  if (pathname === "/" || pathname === "/login") {
    if (profile.role === "super_admin") {
      return redirectWithCookies(request, response, "/super-admin");
    }

    if (profile.role === "hotel_admin" && hotelSlug) {
      return redirectWithCookies(request, response, `/admin/${hotelSlug}`);
    }
  }

  if (pathname.startsWith("/super-admin") && profile.role !== "super_admin") {
    if (profile.role === "hotel_admin" && hotelSlug) {
      return redirectWithCookies(request, response, `/admin/${hotelSlug}`);
    }

    return redirectWithCookies(request, response, "/login");
  }

  if (pathname.startsWith("/admin")) {
    if (profile.role === "super_admin") {
      return redirectWithCookies(request, response, "/super-admin");
    }

    if (profile.role === "hotel_admin") {
      const slugInPath = pathname.split("/")[2] ?? "";

      if (!hotelSlug) {
        return redirectWithCookies(request, response, "/login");
      }

      if (!slugInPath || slugInPath !== hotelSlug) {
        return redirectWithCookies(request, response, `/admin/${hotelSlug}`);
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
