import { Hero } from "@/components/hero";
import { PoliciesDashboard } from "@/components/policies-dashboard";
import { PurchaseForm } from "@/components/purchase-form";
import { WalletConnect } from "@/components/wallet-connect";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-10 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-3 shadow-glow backdrop-blur md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-lg font-black text-primary-foreground">R</div>
          <div>
            <p className="text-sm font-semibold tracking-[0.28em] text-primary">RIALO COVER</p>
            <p className="text-xs text-muted-foreground">Flight cover without paperwork</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <a href="/deploy" className="hidden text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors md:block">
            Deploy
          </a>
          <WalletConnect />
        </div>
      </header>

      <section className="grid items-start gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Hero />
        <PurchaseForm />
      </section>

      <PoliciesDashboard />
    </main>
  );
}
