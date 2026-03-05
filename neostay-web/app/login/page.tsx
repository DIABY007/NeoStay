import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-6 py-16 text-slate-900">
      <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="mb-3 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Acces securise
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Connexion Admin</h1>
        <p className="mt-2 text-sm text-slate-600">
          Entrez votre numero WhatsApp au format Burkina Faso (+226, 8 chiffres)
          pour recevoir un OTP.
        </p>

        <div className="mt-6">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
