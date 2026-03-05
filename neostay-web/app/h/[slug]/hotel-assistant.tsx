"use client";

import { useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type Props = {
  hotelSlug: string;
  hotelName: string;
};

export function HotelAssistant({ hotelSlug, hotelName }: Props) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: `Bonjour, je suis l'assistant de ${hotelName}. Posez-moi vos questions sur l'hotel.`,
    },
  ]);
  const [status, setStatus] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const question = input.trim();
    if (question.length < 2 || loading) {
      return;
    }

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: question }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setStatus(null);

    const history = nextMessages.slice(-8);

    const response = await fetch(`/api/public/hotels/${hotelSlug}/assistant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: question, history }),
    });

    const result = await response.json();
    setLoading(false);

    if (!response.ok || !result.success) {
      setStatus(result.error ?? "Assistant indisponible pour le moment.");
      return;
    }

    const reply = String(result.reply ?? "").trim();
    if (!reply) {
      setStatus("Reponse vide de l'assistant.");
      return;
    }

    setMessages((previous) => [...previous, { role: "assistant", content: reply }]);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Assistant hotel</h2>
      <p className="mt-1 text-sm text-slate-600">Questions frequentes, horaires, services, politiques et infos pratiques.</p>

      <div className="mt-4 max-h-80 space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`max-w-[92%] rounded-xl px-3 py-2 text-sm ${
              message.role === "user"
                ? "ml-auto bg-amber-700 text-white"
                : "bg-white text-slate-800"
            }`}
          >
            {message.content}
          </div>
        ))}
        {loading && <p className="text-xs text-slate-500">Assistant en train de repondre...</p>}
      </div>

      <form className="mt-3 flex gap-2" onSubmit={onSubmit}>
        <input
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Ex: Quels sont les horaires du petit dejeuner ?"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={loading}
        />
        <button
          type="submit"
          className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-60"
          disabled={loading || input.trim().length < 2}
        >
          Envoyer
        </button>
      </form>

      {status && <p className="mt-3 text-xs text-rose-700">{status}</p>}
    </section>
  );
}