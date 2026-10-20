export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-cyan-300">Devnet</p>
      <h1 className="text-5xl font-black tracking-tight sm:text-7xl">
        <span className="text-fuchsia-400">BATTLE</span>{" "}
        <span className="text-cyan-300">LAUNCH</span>
      </h1>
      <p className="max-w-md text-base text-zinc-400">
        Two Pump.fun memecoins, launched at the same time, on the same theme. One hour, three or
        six. One winner.
      </p>
      <p className="max-w-md text-xs text-zinc-500">
        Extremely risky. No promise of gains. Not financial advice.
      </p>
    </main>
  );
}
