import Link from "next/link";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f6f4ef] px-6 py-10 text-[#1f2f24] sm:px-10 md:px-16">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-[#c8dcb7]/50 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 translate-x-1/4 translate-y-1/4 rounded-full bg-[#f0b67f]/35 blur-3xl" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-16">
        <header className="flex items-center justify-between rounded-full border border-[#1f2f24]/10 bg-white/75 px-5 py-3 backdrop-blur">
          <span className="text-sm font-semibold uppercase tracking-[0.22em] text-[#45634a]">
            NeoStay
          </span>
          <Link
            href="/login"
            className="rounded-full border border-[#1f2f24]/20 bg-white px-4 py-2 text-sm font-medium text-[#1f2f24] transition hover:-translate-y-0.5 hover:bg-[#fef7ec]"
          >
            Se connecter
          </Link>
        </header>

        <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-7">
            <p className="inline-flex rounded-full border border-[#45634a]/20 bg-white/80 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#45634a]">
              Hotel Management Platform
            </p>

            <h1 className="max-w-2xl text-4xl font-black leading-tight tracking-tight text-[#1d2a1f] sm:text-5xl md:text-6xl">
              Simplifiez la gestion de vos reservations hotelieres.
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-[#3f5244] sm:text-lg">
              NeoStay centralise vos disponibilites, vos reservations et votre
              pilotage multi-etablissements dans une interface rapide et claire.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full bg-[#1f2f24] px-7 py-3 text-sm font-semibold text-white shadow-[0_10px_35px_-12px_rgba(31,47,36,0.65)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#2e4535]"
              >
                Se connecter
              </Link>
              <span className="text-sm text-[#56705e]">
                Accessible depuis votre espace admin et super-admin
              </span>
            </div>
          </div>

          <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-[0_30px_80px_-40px_rgba(29,42,31,0.45)] backdrop-blur sm:p-8">
            <div className="grid gap-4">
              <div className="rounded-2xl border border-[#1f2f24]/10 bg-[#f8fbf4] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4e6a53]">
                  Temps reel
                </p>
                <p className="mt-2 text-2xl font-black text-[#1f2f24]">+148</p>
                <p className="text-sm text-[#4e6a53]">Reservations confirmees</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-[#1f2f24]/10 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4e6a53]">
                    Check-in
                  </p>
                  <p className="mt-2 text-lg font-bold text-[#1f2f24]">Fluide</p>
                </div>
                <div className="rounded-2xl border border-[#1f2f24]/10 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4e6a53]">
                    Support
                  </p>
                  <p className="mt-2 text-lg font-bold text-[#1f2f24]">24/7</p>
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
