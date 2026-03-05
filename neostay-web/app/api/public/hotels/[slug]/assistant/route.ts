import { NextResponse } from "next/server";

import { selectRelevantKnowledgeContext } from "@/lib/hotel-knowledge";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ slug: string }> };

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type RequestBody = {
  message?: string;
  history?: ChatMessage[];
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4o-mini";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: Params) {
  const { slug } = await params;
  const body = (await request.json()) as RequestBody;
  const message = (body.message ?? "").trim();

  if (message.length < 2) {
    return NextResponse.json(
      { success: false, error: "Message trop court." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServiceRoleClient();

  const { data: hotel, error: hotelError } = await supabase
    .from("hotels")
    .select("id, name, whatsapp_number, status")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle<{ id: string; name: string; whatsapp_number: string; status: string }>();

  if (hotelError || !hotel) {
    return NextResponse.json({ success: false, error: "Hotel introuvable." }, { status: 404 });
  }

  const { data: knowledge, error: knowledgeError } = await supabase
    .from("hotel_knowledge_documents")
    .select("source_text")
    .eq("hotel_id", hotel.id)
    .maybeSingle<{ source_text: string }>();

  if (knowledgeError) {
    return NextResponse.json(
      { success: false, error: `Lecture base connaissance impossible: ${knowledgeError.message}` },
      { status: 500 },
    );
  }

  if (!knowledge?.source_text) {
    return NextResponse.json({
      success: true,
      configured: false,
      reply:
        "Je n'ai pas encore recu le guide PDF de cet hotel. Merci de contacter la reception sur WhatsApp pour les informations detaillees.",
    });
  }

  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterApiKey) {
    return NextResponse.json(
      { success: false, error: "OPENROUTER_API_KEY manquant dans les variables d'environnement." },
      { status: 500 },
    );
  }

  const context = selectRelevantKnowledgeContext(knowledge.source_text, message, 12000);
  const cleanHistory = (body.history ?? [])
    .filter((item) => item.role === "user" || item.role === "assistant")
    .filter((item) => typeof item.content === "string" && item.content.trim().length > 0)
    .slice(-6)
    .map((item) => ({
      role: item.role,
      content: item.content.trim().slice(0, 1200),
    }));

  const openRouterBody = {
    model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "Tu es l'assistant client de l'hotel. Reponds en francais clair, court et utile. Utilise prioritairement le contexte fourni. Si l'information n'est pas presente, dis-le honnetement et propose de contacter la reception.",
      },
      ...cleanHistory,
      {
        role: "user",
        content: [
          `Hotel: ${hotel.name}`,
          `WhatsApp reception: ${hotel.whatsapp_number}`,
          "Contexte extrait du PDF hotel:",
          context,
          "Question client:",
          message,
        ].join("\n\n"),
      },
    ],
  };

  const openRouterResponse = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openRouterApiKey}`,
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:3000",
      "X-OpenRouter-Title": process.env.OPENROUTER_SITE_TITLE || "NeoStay",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(openRouterBody),
  });

  const openRouterResult = (await openRouterResponse.json()) as OpenRouterResponse;

  if (!openRouterResponse.ok) {
    return NextResponse.json(
      {
        success: false,
        error:
          openRouterResult.error?.message ||
          `OpenRouter error (status ${openRouterResponse.status}).`,
      },
      { status: 502 },
    );
  }

  const reply = openRouterResult.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    return NextResponse.json(
      { success: false, error: "Reponse vide du modele." },
      { status: 502 },
    );
  }

  return NextResponse.json({ success: true, configured: true, reply });
}