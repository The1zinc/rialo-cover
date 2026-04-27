import { ShieldCheck, TimerReset, Waves } from "lucide-react";

const stats = [
  { label: "Traditional backend DB", value: "0" },
  { label: "Policy storage", value: "On-chain" },
  { label: "Claim review", value: "Instant" },
];

export function Hero() {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-card/70 p-6 shadow-glow backdrop-blur md:p-8 lg:min-h-[520px]">
      <div className="absolute right-8 top-8 hidden h-36 w-36 rounded-full border border-primary/30 bg-primary/10 blur-sm md:block" />
      <div className="relative z-10 flex h-full flex-col justify-between gap-12">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-2 text-sm text-primary">
            <Waves className="h-4 w-4" />
            Parametric cover for real flights
          </div>
          <div className="space-y-5">
            <h1 className="max-w-3xl text-5xl font-black tracking-tight text-balance sm:text-6xl lg:text-7xl">
              Instant payouts, no paperwork.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
              Buy delay cover with your wallet. The intelligent contract stores your policy, checks live flight data directly over HTTPS, and pays eligible claims automatically.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-2xl font-black text-white">{stat.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-primary/20 bg-primary/10 p-4">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <p className="mt-3 font-semibold">No database</p>
            <p className="mt-1 text-sm text-muted-foreground">Users, premiums, and policy states live on the contract only.</p>
          </div>
          <div className="rounded-3xl border border-accent/20 bg-accent/10 p-4">
            <TimerReset className="h-6 w-6 text-accent" />
            <p className="mt-3 font-semibold">Native verification</p>
            <p className="mt-1 text-sm text-muted-foreground">The contract performs the Web2 API request during claim resolution.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
