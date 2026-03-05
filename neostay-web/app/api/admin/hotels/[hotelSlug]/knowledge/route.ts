import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { ensureHotelAdminForSlug } from "@/lib/auth/hotel-admin";
import { extractTextFromPdfBuffer } from "@/lib/hotel-knowledge";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ hotelSlug: string }> };

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;
const KNOWLEDGE_BUCKET = process.env.SUPABASE_HOTEL_KNOWLEDGE_BUCKET || "hotel-knowledge-pdfs";

type DocumentRow = {
  id: string;
  file_name: string;
  source_chars: number;
  object_path: string;
  updated_at: string;
};

export const runtime = "nodejs";

export async function GET(_: Request, { params }: Params) {
  const { hotelSlug } = await params;
  const auth = await ensureHotelAdminForSlug(hotelSlug);

  if (!auth.ok || !auth.hotelId) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("hotel_knowledge_documents")
    .select("id, file_name, source_chars, object_path, updated_at")
    .eq("hotel_id", auth.hotelId)
    .maybeSingle<DocumentRow>();

  if (error) {
    return NextResponse.json(
      { success: false, error: `Chargement document impossible: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    hasDocument: Boolean(data),
    document: data,
  });
}

export async function POST(request: Request, { params }: Params) {
  const { hotelSlug } = await params;
  const auth = await ensureHotelAdminForSlug(hotelSlug);

  if (!auth.ok || !auth.hotelId || !auth.userId) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, error: "Aucun fichier PDF recu." }, { status: 400 });
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json(
      { success: false, error: "Format invalide. Uniquement PDF autorise." },
      { status: 400 },
    );
  }

  if (file.size > MAX_PDF_SIZE_BYTES) {
    return NextResponse.json(
      { success: false, error: "Le PDF depasse 10 MB." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServiceRoleClient();

  const { data: existingRow, error: existingError } = await supabase
    .from("hotel_knowledge_documents")
    .select("id, object_path")
    .eq("hotel_id", auth.hotelId)
    .maybeSingle<{ id: string; object_path: string }>();

  if (existingError) {
    return NextResponse.json(
      { success: false, error: `Lecture document existant impossible: ${existingError.message}` },
      { status: 500 },
    );
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  let extractedText = "";

  try {
    extractedText = await extractTextFromPdfBuffer(fileBuffer);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? `Lecture du PDF impossible: ${error.message}`
            : "Lecture du PDF impossible.",
      },
      { status: 400 },
    );
  }

  if (extractedText.length < 50) {
    return NextResponse.json(
      {
        success: false,
        error: "Le PDF ne contient pas assez de texte exploitable.",
      },
      { status: 400 },
    );
  }

  const objectPath = `${auth.hotelId}/${Date.now()}-${randomUUID()}.pdf`;

  const { error: uploadError } = await supabase.storage.from(KNOWLEDGE_BUCKET).upload(objectPath, fileBuffer, {
    upsert: false,
    contentType: "application/pdf",
    cacheControl: "3600",
  });

  if (uploadError) {
    return NextResponse.json(
      { success: false, error: `Upload PDF impossible: ${uploadError.message}` },
      { status: 500 },
    );
  }

  const { data: savedDoc, error: saveError } = await supabase
    .from("hotel_knowledge_documents")
    .upsert(
      {
        hotel_id: auth.hotelId,
        file_name: file.name,
        storage_bucket: KNOWLEDGE_BUCKET,
        object_path: objectPath,
        source_text: extractedText,
        source_chars: extractedText.length,
        uploaded_by: auth.userId,
      },
      { onConflict: "hotel_id" },
    )
    .select("id, file_name, source_chars, object_path, updated_at")
    .single<DocumentRow>();

  if (saveError) {
    await supabase.storage.from(KNOWLEDGE_BUCKET).remove([objectPath]);
    return NextResponse.json(
      { success: false, error: `Sauvegarde du document impossible: ${saveError.message}` },
      { status: 500 },
    );
  }

  if (existingRow?.object_path && existingRow.object_path !== objectPath) {
    await supabase.storage.from(KNOWLEDGE_BUCKET).remove([existingRow.object_path]);
  }

  return NextResponse.json({
    success: true,
    message: "Document hotel importe avec succes.",
    document: savedDoc,
  });
}