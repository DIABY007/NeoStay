import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { ensureHotelAdminForSlug } from "@/lib/auth/hotel-admin";
import { compressImageForUpload } from "@/lib/image-processing";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ hotelSlug: string }> };

const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

export const runtime = "nodejs";

function getLogoBucketName() {
  return process.env.SUPABASE_HOTEL_LOGOS_BUCKET || "hotel-logos";
}

async function ensureLogoBucketReady(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  bucketName: string,
) {
  const allowedMimeTypes = Array.from(ALLOWED_LOGO_TYPES);

  const { error: createError } = await supabase.storage.createBucket(bucketName, {
    public: true,
    fileSizeLimit: MAX_LOGO_SIZE_BYTES,
    allowedMimeTypes,
  });

  if (createError) {
    const message = createError.message.toLowerCase();
    const alreadyExists = message.includes("already exists") || message.includes("duplicate");

    if (!alreadyExists) {
      return {
        ok: false as const,
        error: `Initialisation bucket logo impossible: ${createError.message}`,
      };
    }
  }

  const { error: updateError } = await supabase.storage.updateBucket(bucketName, {
    public: true,
    fileSizeLimit: MAX_LOGO_SIZE_BYTES,
    allowedMimeTypes,
  });

  if (updateError) {
    return {
      ok: false as const,
      error: `Configuration bucket logo impossible: ${updateError.message}`,
    };
  }

  return { ok: true as const };
}

function extractObjectPathFromPublicUrl(publicUrl: string, bucketName: string) {
  const marker = `/storage/v1/object/public/${bucketName}/`;
  const markerIndex = publicUrl.indexOf(marker);

  if (markerIndex === -1) {
    return null;
  }

  const pathWithQuery = publicUrl.slice(markerIndex + marker.length);
  const path = pathWithQuery.split("?")[0];
  return decodeURIComponent(path);
}

export async function POST(request: Request, { params }: Params) {
  const { hotelSlug } = await params;
  const auth = await ensureHotelAdminForSlug(hotelSlug);

  if (!auth.ok || !auth.hotelId) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, error: "Aucun fichier recu." }, { status: 400 });
  }

  if (!ALLOWED_LOGO_TYPES.has(file.type)) {
    return NextResponse.json(
      {
        success: false,
        error: "Type de fichier invalide (PNG, JPG, WEBP, SVG uniquement).",
      },
      { status: 400 },
    );
  }

  if (file.size > MAX_LOGO_SIZE_BYTES) {
    return NextResponse.json(
      { success: false, error: "Le fichier depasse 2 MB." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServiceRoleClient();
  const bucketName = getLogoBucketName();
  const bucketReady = await ensureLogoBucketReady(supabase, bucketName);

  if (!bucketReady.ok) {
    return NextResponse.json({ success: false, error: bucketReady.error }, { status: 500 });
  }

  const { data: currentHotel, error: currentHotelError } = await supabase
    .from("hotels")
    .select("logo_url")
    .eq("id", auth.hotelId)
    .single();

  if (currentHotelError) {
    return NextResponse.json(
      { success: false, error: `Lecture hotel impossible: ${currentHotelError.message}` },
      { status: 500 },
    );
  }

  const processedImage = await compressImageForUpload(file, {
    maxWidth: 640,
    maxHeight: 640,
    quality: 82,
  });
  const objectPath = `${auth.hotelId}/${Date.now()}-${randomUUID()}.${processedImage.extension}`;

  const { error: uploadError } = await supabase.storage.from(bucketName).upload(objectPath, processedImage.bytes, {
    upsert: false,
    contentType: processedImage.contentType,
    cacheControl: "3600",
  });

  if (uploadError) {
    return NextResponse.json(
      { success: false, error: `Upload logo impossible: ${uploadError.message}` },
      { status: 500 },
    );
  }

  const { data: logoPublicData } = supabase.storage.from(bucketName).getPublicUrl(objectPath);
  const logoUrl = logoPublicData.publicUrl;

  const { data: updatedHotel, error: updateError } = await supabase
    .from("hotels")
    .update({ logo_url: logoUrl })
    .eq("id", auth.hotelId)
    .select("id, logo_url")
    .single();

  if (updateError) {
    await supabase.storage.from(bucketName).remove([objectPath]);

    return NextResponse.json(
      { success: false, error: `Mise a jour logo impossible: ${updateError.message}` },
      { status: 500 },
    );
  }

  const previousPath = currentHotel.logo_url
    ? extractObjectPathFromPublicUrl(currentHotel.logo_url, bucketName)
    : null;

  if (previousPath) {
    await supabase.storage.from(bucketName).remove([previousPath]);
  }

  return NextResponse.json({
    success: true,
    logoUrl: updatedHotel.logo_url,
  });
}
