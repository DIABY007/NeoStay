"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type HotelSettings = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  theme_color: string;
  hero_title: string | null;
  hero_subtitle: string | null;
  theme_template: "classic" | "modern";
  logo_url: string | null;
  map_embed_html: string | null;
};

type KnowledgeDocument = {
  id: string;
  file_name: string;
  source_chars: number;
  object_path: string;
  updated_at: string;
};

type Props = {
  hotelSlug: string;
};

export function HotelSettingsForm({ hotelSlug }: Props) {
  const [hotel, setHotel] = useState<HotelSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const [description, setDescription] = useState("");
  const [themeColor, setThemeColor] = useState("#0f766e");
  const [heroTitle, setHeroTitle] = useState("");
  const [heroSubtitle, setHeroSubtitle] = useState("");
  const [themeTemplate, setThemeTemplate] = useState<"classic" | "modern">("classic");
  const [logoUrl, setLogoUrl] = useState("");
  const [mapEmbedHtml, setMapEmbedHtml] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [knowledgeDocument, setKnowledgeDocument] = useState<KnowledgeDocument | null>(null);
  const [loadingKnowledge, setLoadingKnowledge] = useState(true);
  const [uploadingKnowledge, setUploadingKnowledge] = useState(false);
  const [selectedKnowledgeFile, setSelectedKnowledgeFile] = useState<File | null>(null);

  async function loadSettings() {
    setLoading(true);
    const response = await fetch(`/api/admin/hotels/${hotelSlug}/settings`, {
      cache: "no-store",
    });
    const result = await response.json();
    setLoading(false);

    if (!response.ok || !result.success) {
      setStatus(result.error ?? "Impossible de charger les parametres hotel.");
      return;
    }

    const data = result.hotel as HotelSettings;
    setHotel(data);
    setDescription(data.description ?? "");
    setThemeColor(data.theme_color);
    setHeroTitle(data.hero_title ?? "");
    setHeroSubtitle(data.hero_subtitle ?? "");
    setThemeTemplate(data.theme_template);
    setLogoUrl(data.logo_url ?? "");
    setMapEmbedHtml(data.map_embed_html ?? "");
  }

  useEffect(() => {
    void loadSettings();
    void loadKnowledge();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelSlug]);

  async function loadKnowledge() {
    setLoadingKnowledge(true);
    const response = await fetch(`/api/admin/hotels/${hotelSlug}/knowledge`, {
      cache: "no-store",
    });
    const result = await response.json();
    setLoadingKnowledge(false);

    if (!response.ok || !result.success) {
      setStatus(result.error ?? "Impossible de charger le document PDF.");
      return null;
    }

    const document = (result.document as KnowledgeDocument | null) ?? null;
    setKnowledgeDocument(document);
    return document;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);

    if (selectedKnowledgeFile) {
      const uploaded = await uploadKnowledgeFile(selectedKnowledgeFile);
      if (!uploaded) {
        setSaving(false);
        return;
      }
    }

    const response = await fetch(`/api/admin/hotels/${hotelSlug}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description,
        themeColor,
        heroTitle,
        heroSubtitle,
        themeTemplate,
        logoUrl,
        mapEmbedHtml,
      }),
    });

    const result = await response.json();
    setSaving(false);

    if (!response.ok || !result.success) {
      setStatus(result.error ?? "Mise a jour impossible.");
      return;
    }

    setStatus("Parametres hotel mis a jour.");
    await loadSettings();
  }

  async function onLogoSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadingLogo(true);
    setStatus(null);

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`/api/admin/hotels/${hotelSlug}/logo`, {
      method: "POST",
      body: formData,
    });

    const result = await response.json();
    setUploadingLogo(false);
    event.target.value = "";

    if (!response.ok || !result.success) {
      setStatus(result.error ?? "Upload du logo impossible.");
      return;
    }

    setLogoUrl(result.logoUrl ?? "");
    setStatus("Logo mis a jour avec succes.");
  }

  async function uploadKnowledgeFile(file: File) {
    if (!file) {
      return false;
    }

    setUploadingKnowledge(true);

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`/api/admin/hotels/${hotelSlug}/knowledge`, {
      method: "POST",
      body: formData,
    });

    const result = await response.json();
    setUploadingKnowledge(false);

    if (!response.ok || !result.success) {
      setStatus(result.error ?? "Upload du PDF impossible.");
      return false;
    }

    const document = await loadKnowledge();
    if (!document) {
      setStatus("Upload termine, mais verification en base introuvable.");
      return false;
    }

    setSelectedKnowledgeFile(null);
    setStatus("Base de connaissance PDF mise a jour.");
    return true;
  }

  async function onKnowledgeSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setSelectedKnowledgeFile(file ?? null);

    if (!file) {
      return;
    }

    setStatus(`PDF selectionne: ${file.name}. Cliquez sur Sauvegarder pour importer.`);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-600">Chargement...</p>
        ) : (
          <form className="grid gap-3" onSubmit={onSubmit}>
            <p className="text-sm text-slate-600">Hotel: {hotel?.name}</p>

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Description</span>
              <textarea
                className="rounded-lg border border-slate-300 px-3 py-2"
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-slate-700">Couleur principale</span>
                <div className="flex items-center gap-3 rounded-lg border border-slate-300 px-3 py-2">
                  <input
                    type="color"
                    className="h-9 w-12 cursor-pointer rounded border border-slate-300 bg-white p-1"
                    value={themeColor}
                    onChange={(event) => setThemeColor(event.target.value)}
                    aria-label="Choisir la couleur principale"
                  />
                  <input
                    className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
                    value={themeColor}
                    onChange={(event) => setThemeColor(event.target.value)}
                    placeholder="#0f766e"
                    pattern="^#([0-9a-fA-F]{6})$"
                    required
                  />
                </div>
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-medium text-slate-700">Template</span>
                <select
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  value={themeTemplate}
                  onChange={(event) => setThemeTemplate(event.target.value as "classic" | "modern")}
                >
                  <option value="classic">classic</option>
                  <option value="modern">modern</option>
                </select>
              </label>
            </div>

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Titre hero</span>
              <input
                className="rounded-lg border border-slate-300 px-3 py-2"
                value={heroTitle}
                onChange={(event) => setHeroTitle(event.target.value)}
                placeholder="Votre sejour ideal commence ici"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Sous-titre hero</span>
              <input
                className="rounded-lg border border-slate-300 px-3 py-2"
                value={heroSubtitle}
                onChange={(event) => setHeroSubtitle(event.target.value)}
                placeholder="Confort, elegance et reservation en 1 clic"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Carte Google Maps (iframe ou URL)</span>
              <textarea
                className="rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
                rows={4}
                value={mapEmbedHtml}
                onChange={(event) => setMapEmbedHtml(event.target.value)}
                placeholder={'Ex: <iframe src="https://www.google.com/maps/embed?..." ...></iframe>'}
              />
              <span className="text-xs text-slate-500">
                Collez le code iframe Google Maps complet ou directement une URL Google Maps embed.
              </span>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Logo hotel</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="rounded-lg border border-slate-300 px-3 py-2"
                onChange={onLogoSelected}
                disabled={uploadingLogo}
              />
              <span className="text-xs text-slate-500">
                Formats acceptes: PNG, JPG, WEBP, SVG. Max 2 MB.
              </span>
              {uploadingLogo && <span className="text-xs text-slate-500">Upload du logo en cours...</span>}
              {logoUrl && (
                <div className="flex items-center gap-3">
                  <Image
                    src={logoUrl}
                    alt="Apercu du logo"
                    className="h-12 w-12 rounded-lg border border-slate-200 object-cover"
                    width={48}
                    height={48}
                  />
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={() => setLogoUrl("")}
                  >
                    Retirer le logo
                  </button>
                </div>
              )}
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Guide PDF de l&apos;hotel (chatbot)</span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="rounded-lg border border-slate-300 px-3 py-2"
                onChange={onKnowledgeSelected}
                disabled={uploadingKnowledge}
              />
              <span className="text-xs text-slate-500">Un seul PDF actif. Max 10 MB.</span>
              {selectedKnowledgeFile && (
                <p className="text-xs text-slate-600">Fichier selectionne: {selectedKnowledgeFile.name}</p>
              )}
              {loadingKnowledge ? (
                <p className="text-xs text-slate-500">Chargement du statut PDF...</p>
              ) : knowledgeDocument ? (
                <p className="text-xs text-slate-600">
                  PDF actif: <span className="font-semibold">{knowledgeDocument.file_name}</span> ({knowledgeDocument.source_chars.toLocaleString("fr-FR")} caracteres)
                </p>
              ) : (
                <p className="text-xs text-amber-700">Aucun PDF importe pour le moment.</p>
              )}
            </label>

            <button
              type="submit"
              className="mt-2 rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-70"
              disabled={saving}
            >
              {saving ? "Sauvegarde..." : "Sauvegarder"}
            </button>
          </form>
        )}
      </section>

      {status && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {status}
        </p>
      )}
    </div>
  );
}
