import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t-2 border-ink bg-ink text-white">
      <div className="ticker border-b border-white/20 py-3 text-xs font-black uppercase tracking-[0.22em]">
        <div>
          <span>Funded campaigns ✦ Creator rewards ✦ Onchain proof ✦ Funded campaigns ✦ Creator rewards ✦ Onchain proof ✦ Funded campaigns ✦ Creator rewards ✦ Onchain proof ✦ </span>
          <span>Funded campaigns ✦ Creator rewards ✦ Onchain proof ✦ Funded campaigns ✦ Creator rewards ✦ Onchain proof ✦ Funded campaigns ✦ Creator rewards ✦ Onchain proof ✦ </span>
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 md:grid-cols-[1.4fr_1fr_1fr] md:px-6">
        <div>
          <p className="font-display text-5xl uppercase tracking-[-0.06em]">
            Clipfun
          </p>
          <p className="mt-3 max-w-sm text-sm leading-6 text-white/60">
            Where brands fund the brief and creators earn with proof.
          </p>
        </div>
        <div>
          <p className="mb-4 text-[10px] font-black uppercase tracking-widest text-lime">
            Product
          </p>
          <div className="space-y-2 text-sm">
            <Link className="block" href="/explore">Explore campaigns</Link>
            <Link className="block" href="/brand">Brand dashboard</Link>
            <Link className="block" href="/clipper">Creator dashboard</Link>
          </div>
        </div>
        <div>
          <p className="mb-4 text-[10px] font-black uppercase tracking-widest text-lime">
            Demo environment
          </p>
          <p className="text-sm leading-6 text-white/60">
            Base Sepolia<br />
            Mock USDC<br />
            No real funds
          </p>
        </div>
      </div>
    </footer>
  );
}
