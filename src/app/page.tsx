import type { Metadata } from "next";
import Link from "next/link";
import { AudioWaveform, ArrowRight, Play, FileAudio, Music4, FileText, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: {
    absolute: "SonicBlueprint — Music Composition Tool, Chord Progression Builder & Instrumental Maker",
  },
  description:
    "Create chord progressions, rhythms, basslines, melodies, arrangements, and complete instrumental blueprints — then preview and export your music.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "SonicBlueprint",
    locale: "en_US",
    title: "SonicBlueprint — Design Your Music. Build Your Blueprint.",
    description:
      "Create chord progressions, rhythms, basslines, melodies, arrangements, and complete instrumental blueprints — then preview and export your music.",
    url: "/",
    images: [
      { url: "/og-image-square.png", width: 1200, height: 1200, alt: "SonicBlueprint — Design Your Music. Build Your Blueprint." },
      { url: "/og-image.png", width: 1200, height: 630, alt: "SonicBlueprint — Design Your Music. Build Your Blueprint." },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SonicBlueprint — Design Your Music. Build Your Blueprint.",
    description:
      "Create chord progressions, rhythms, basslines, melodies, arrangements, and complete instrumental blueprints — then preview and export your music.",
    images: ["/og-image.png"],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "SonicBlueprint",
  applicationCategory: "MusicApplication",
  operatingSystem: "Web",
  browserRequirements: "Requires a modern browser with Web Audio support",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  description:
    "Browser-based music composition tool for building chord progressions, drum patterns and arrangements, with MP3, MIDI and PDF export.",
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#06070d] text-slate-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div className="grid-bg pointer-events-none fixed inset-0" aria-hidden="true" />
      <header className="relative mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-3 px-4 py-4 sm:px-6 sm:py-5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#6e8bff] to-[#a78bfa] sm:h-10 sm:w-10">
          <AudioWaveform aria-hidden="true" className="h-5 w-5 text-white" />
        </span>
        <span className="min-w-0 flex-1 truncate text-base font-extrabold tracking-wide sm:flex-none sm:text-lg">SONICBLUEPRINT</span>
        <nav className="ml-auto flex shrink-0 items-center gap-1.5 text-sm sm:gap-2">
          <Link href="/presets" className="hidden rounded-lg px-3 py-2 text-slate-300 hover:bg-white/5 hover:text-white min-[420px]:block">
            Explore Presets
          </Link>
          <Link href="/dashboard" className="rounded-lg bg-[#6e8bff] px-3 py-2 font-semibold text-[#0b1020] hover:bg-[#7f99ff] sm:px-4">
            Create a Blueprint
          </Link>
        </nav>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 pb-20">
        <section className="grid items-center gap-10 pt-10 md:grid-cols-2 md:pt-16">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#2a3a6b] bg-[#6e8bff]/10 px-3 py-1 text-[12px] text-[#aebfff]">
              <Sparkles aria-hidden="true" className="h-3.5 w-3.5" /> Runs entirely in your browser — nothing to install
            </p>
            <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight md:text-6xl">
              SONICBLUEPRINT
              <span className="mt-3 block bg-gradient-to-r from-[#6e8bff] via-[#a78bfa] to-[#5eead4] bg-clip-text text-2xl font-bold text-transparent md:text-3xl">
                Design the music.
                <br />
                Build the blueprint.
                <br />
                Produce the track.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-slate-400">
              SonicBlueprint lets creators design instrumental ideas visually — chords, drums, bass,
              instruments and arrangement — hear every edit instantly, and export browser-rendered
              MP3 reference recordings, MIDI and PDF blueprints. No advanced theory required: progressions transpose
              automatically and every chord is shown in plain language with playable preview.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/dashboard" className="inline-flex h-12 items-center gap-2 rounded-lg bg-[#6e8bff] px-6 font-semibold text-[#0b1020] shadow-[0_0_24px_rgba(110,139,255,0.4)] hover:bg-[#7f99ff]">
                Create a Blueprint <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
              <Link href="/presets" className="inline-flex h-12 items-center gap-2 rounded-lg border border-[#2a3a6b] px-6 font-semibold text-slate-100 hover:border-[#6e8bff]">
                <Play aria-hidden="true" className="h-4 w-4" /> Explore Presets
              </Link>
            </div>
            <dl className="mt-8 grid max-w-md grid-cols-3 gap-4 text-center">
              {[
                ["40+", "chord loops"],
                ["20+", "drum patterns"],
                ["13", "instrument groups"],
              ].map(([n, l]) => (
                <div key={l} className="rounded-xl border border-[#1e2a4a] bg-[#0e1424]/80 p-3">
                  <dt className="text-xl font-extrabold text-white">{n}</dt>
                  <dd className="text-[12px] text-slate-400">{l}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* editor preview mock (live links, real routes) */}
          <div className="glass overflow-hidden rounded-2xl" aria-label="Editor preview">
            <div className="flex items-center gap-2 border-b border-[#1e2a4a] px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
              <span className="ml-2 font-mono text-[12px] text-slate-400">Track 07 — D minor • 100 BPM</span>
            </div>
            <div className="space-y-3 p-4">
              <div className="flex gap-2">
                {["Dm", "B♭", "F", "C"].map((c, i) => (
                  <div key={c} className={`flex-1 rounded-lg border px-3 py-2.5 ${i === 1 ? "border-[#6e8bff] bg-[#6e8bff]/15" : "border-[#22305c] bg-white/[0.03]"}`}>
                    <div className="text-sm font-bold">{c}</div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-black/50">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#6e8bff] to-[#a78bfa]" style={{ width: `${[70, 92, 55, 80][i]}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-[#22305c] bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-slate-400">
                KICK&nbsp;&nbsp;&nbsp;● — — — ● — — — ● — — — ● — — —
                <br />
                SNARE&nbsp;&nbsp;— — — — ● — — — — — — — ● — — —
                <br />
                HI-HAT&nbsp;● — ● — ● — ● — ● — ● — ● — ● —
              </div>
              <div className="flex h-10 items-end gap-1" aria-hidden="true">
                {[38, 62, 45, 80, 52, 70, 34, 58, 74, 48, 66, 42, 60, 50, 72, 56, 44, 68, 40, 76].map((h, i) => (
                  <div key={i} className="flex-1 rounded-sm bg-[#6e8bff]/60" style={{ height: `${h}%` }} />
                ))}
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] p-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[#6e8bff]"><Play className="ml-0.5 h-4 w-4 text-white" /></span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#1a2340]">
                  <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-[#6e8bff] to-[#a78bfa]" />
                </div>
                <span className="font-mono text-[11px] text-slate-400">0:48 / 2:56</span>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-16 grid gap-4 md:grid-cols-3">
          {[
            { icon: Play, t: "Hear everything", d: "Hybrid sampled/synthesized preview plays your actual chords, drums, bass, melody and arrangement — never a stock file." },
            { icon: Music4, t: "Theory made visual", d: "Dm → B♭ → F → C is also shown as D minor → B♭ major → F major → C major, with one-tap audition." },
            { icon: FileText, t: "Export the blueprint", d: "MP3 reference, meaningful MIDI (tempo, time sig, drums, melody) and a production-grade PDF document." },
            { icon: FileAudio, t: "MP3 in-browser", d: "Offline render + client-side encode. Filenames like SonicBlueprint_Track07_Instrumental.mp3." },
            { icon: Sparkles, t: "Original by design", d: "Honest in-project originality checks. No false guarantees about third-party similarity systems." },
            { icon: ArrowRight, t: "Save & reopen", d: "Versioned JSON in IndexedDB with rename, duplicate, delete, export and import." },
          ].map((f) => (
            <div key={f.t} className="rounded-xl border border-[#1e2a4a] bg-[#0e1424]/80 p-5">
              <f.icon aria-hidden="true" className="mb-3 h-5 w-5 text-[#6e8bff]" />
              <h2 className="font-bold">{f.t}</h2>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-400">{f.d}</p>
            </div>
          ))}
        </section>

        <section className="mt-12 rounded-2xl border border-[#2a3a6b] bg-gradient-to-br from-[#101736] to-[#0a0e1a] p-8 text-center">
          <h2 className="text-2xl font-extrabold">Start with a sound, not a blank page.</h2>
          <p className="mx-auto mt-2 max-w-xl text-slate-400">Thirteen quick-start templates — cinematic pop to ambient — every one fully editable down to the last step.</p>
          <div className="mt-5 flex justify-center gap-3">
            <Link href="/dashboard" className="rounded-lg bg-[#6e8bff] px-6 py-3 font-semibold text-[#0b1020] hover:bg-[#7f99ff]">Open Dashboard</Link>
            <Link href="/projects" className="rounded-lg border border-[#2a3a6b] px-6 py-3 font-semibold hover:border-[#6e8bff]">Saved Projects</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
