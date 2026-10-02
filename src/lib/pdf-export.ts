// Professional PDF Music Blueprint via jsPDF (loaded on demand to keep initial load small).
import type { SonicProject } from "./project-schema";
import { LAYER_IDS, getLayers, type LayerId } from "./project-schema";
import { chordLongName } from "./music-theory";
import { checkOriginality, ORIGINALITY_DISCLAIMER } from "./originality";
import { normalizeBpm, quarterBeatsOf } from "./timing";

export function sectionTimeline(p: SonicProject): { name: string; start: string; bars: number; energy: number }[] {
  const spq = 60 / normalizeBpm(p.config?.bpm);
  const qpb = quarterBeatsOf(p.config?.timeSignature ?? "4/4");
  let t = 0;
  return p.arrangement.map((s) => {
    const start = t;
    t += s.bars * qpb * spq;
    const mm = Math.floor(start / 60);
    const ss = Math.floor(start % 60).toString().padStart(2, "0");
    return { name: s.name, start: `${mm}:${ss}`, bars: s.bars, energy: s.energy };
  });
}

export async function exportPdf(p: SonicProject): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  let y = 56;

  const title = (t: string, size = 11) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(110, 139, 255);
    doc.text(t.toUpperCase(), M, y);
    y += 18;
  };
  const body = (t: string, size = 10) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(30, 30, 40);
    const lines = doc.splitTextToSize(t, W - M * 2);
    doc.text(lines, M, y);
    y += lines.length * 13 + 4;
  };
  const kv = (k: string, v: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 100);
    doc.text(k.toUpperCase(), M, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(20, 20, 30);
    doc.text(v, M + 150, y);
    y += 16;
  };
  const ensure = (need: number) => {
    if (y + need > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      y = 56;
    }
  };

  // header band
  doc.setFillColor(6, 7, 13);
  doc.rect(0, 0, W, 86, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(230, 235, 245);
  doc.text("SONICBLUEPRINT", M, 38);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(140, 160, 220);
  doc.text("MUSIC BLUEPRINT  •  instrumental reference document", M, 58);
  doc.setFontSize(9);
  doc.setTextColor(120, 130, 170);
  doc.text(`Project ID ${p.meta.id}  •  ${new Date().toLocaleDateString()}`, W - M - 220, 38);
  y = 112;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(15, 15, 25);
  doc.text(p.meta.name || "Untitled Blueprint", M, y);
  y += 10;

  title("Project");
  kv("Key", `${p.config.keyTonic.replace("b", "♭")} ${p.config.scale === "major" ? "Major" : "Minor"}`);
  kv("Tempo", `${normalizeBpm(p.config?.bpm)} BPM`);
  kv("Time signature", p.config.timeSignature);
  kv("Mood", p.config.mood);
  kv("Energy", `${p.config.energy} / 10`);
  kv("Dynamics", `${p.config.dynamics} / 10`);
  ensure(40);

  title("Musical layers");
  {
    const layers = getLayers(p);
    const names: Record<LayerId, string> = {
      chords: "Chords",
      drums: "Drums",
      bass: "Bass",
      melody: "Melody",
    };
    for (const id of LAYER_IDS) {
      const on = layers[id];
      ensure(20);
      doc.setFont("helvetica", on ? "bold" : "normal");
      doc.setFontSize(10);
      doc.setTextColor(on ? 20 : 130, on ? 20 : 130, on ? 30 : 150);
      doc.text(
        `${on ? "●" : "○"} ${names[id]} — ${on ? "included" : "muted (settings kept)"}`,
        M,
        y
      );
      y += 15;
    }
    y += 4;
  }

  title("Chord progression");  body(
    p.chords.chords.map((c) => c.replace("b", "♭")).join("  →  ") +
      `\n${p.chords.chords.map(chordLongName).join("  →  ")}` +
      `\n${p.chords.beatsPerChord} beats per chord  •  octave ${p.chords.octave}`
  );

  title("Rhythm & bass");
  const drumRows = Object.entries(p.drums.grid)
    .filter(([, col]) => col.some(Boolean))
    .map(([row, col]) => `${row}: ${col.map((v) => (v ? "●" : "–")).join(" ")}`)
    .join("\n");
  body(
    `Drum pattern “${p.drums.patternId}” — ${p.drums.steps} steps, swing ${Math.round(p.drums.swing * 100)}%.\n${drumRows}\nBass: ${p.bass.styleId}, octave ${p.bass.octave}, volume ${Math.round(p.bass.volume * 100)}%.`
  );

  title("Instruments");
  for (const i of p.instruments) {
    ensure(20);
    doc.setFont("helvetica", i.enabled ? "bold" : "normal");
    doc.setFontSize(10);
    doc.setTextColor(i.enabled ? 20 : 130, i.enabled ? 20 : 130, i.enabled ? 30 : 150);
    doc.text(`${i.enabled ? "●" : "○"} ${i.name} [${i.group}] — ${i.role}, vol ${Math.round(i.volume * 100)}%, pan ${i.pan > 0 ? "R" : i.pan < 0 ? "L" : "C"}${Math.abs(Math.round(i.pan * 100)) || ""}, ${i.octave >= 0 ? "+" : ""}${i.octave} oct, ${i.style}/${i.patternVariant}`, M, y);
    y += 15;
  }
  y += 4;

  title("Arrangement");
  for (const s of sectionTimeline(p)) {
    ensure(18);
    kv(s.start, `${s.name} — ${s.bars} bars, energy ${s.energy}/10`);
  }

  title("Production notes");
  body(
    `Melody style “${p.melodyStyle}”. Dynamics ${p.config.dynamics}/10: keep verses sparse (piano + pad + sub), open the chorus with strings, brass stabs and full drums. Playback feel (Exact / Subtle / Natural / Expressive) shapes timing and velocity during preview and MP3 rendering only — the notes above are the composition. Reference at low volume before export.`
  );

  title("Originality checklist");
  for (const f of checkOriginality(p)) {
    ensure(30);
    body(`[${f.level.toUpperCase()}] ${f.title} — ${f.detail}`);
  }
  body(ORIGINALITY_DISCLAIMER);

  doc.setFontSize(8);
  doc.setTextColor(130, 130, 150);
  doc.text("Generated by SonicBlueprint — designed for original composition.", M, doc.internal.pageSize.getHeight() - 30);

  return doc.output("blob");
}
