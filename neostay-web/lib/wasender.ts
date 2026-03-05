const WASENDER_API_URL =
  process.env.WASENDER_API_URL || "https://www.wasenderapi.com/api";
const WASENDER_API_KEY = process.env.WASENDER_API_KEY || "";

export interface WasenderResponse {
  success: boolean;
  data?: { msgId: number; jid: string; status: string };
  error?: string;
}

export async function sendOtpWhatsApp(
  to: string,
  code: string,
): Promise<WasenderResponse> {
  const text = `Votre code de vérification NeoStay est : ${code}\n\nCe code est valide pendant 10 minutes.`;

  try {
    const response = await fetch(`${WASENDER_API_URL}/send-message`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WASENDER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to, text }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || "Erreur lors de l'envoi du message",
      };
    }

    return { success: true, data: data.data };
  } catch (error) {
    console.error("Erreur WasenderAPI:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur inconnue",
    };
  }
}
