// Tests: export data generation (filenames, MIDI bytes, PDF blob, timeline).
import { suite, test, eq, ok } from "./helpers";
import { createProject } from "@/lib/project-schema";
import { exportMidi, midiFilename } from "@/lib/midi-export";
import { exportPdf, sectionTimeline } from "@/lib/pdf-export";
import { mp3Filename } from "@/lib/mp3-export";

const P = createProject("Track 07");

suite("export filenames");

test("names are filesystem-safe and descriptive", () => {
  eq(midiFilename("Track 07"), "SonicBlueprint_Track_07.mid");
  eq(mp3Filename("Track 07"), "SonicBlueprint_Track_07_Instrumental.mp3");
  eq(midiFilename("Night/Mix: v2?"), "SonicBlueprint_NightMix_v2.mid");
  eq(midiFilename(""), "SonicBlueprint_Project.mid");
  eq(mp3Filename(""), "SonicBlueprint_Project_Instrumental.mp3");
});

suite("MIDI event generation");

test("export produces a valid Standard MIDI File", async () => {
  const blob = await exportMidi(P);
  ok(blob.size > 100, `size ${blob.size}`);
  const buf = new Uint8Array(await blob.arrayBuffer());
  eq(String.fromCharCode(...buf.slice(0, 4)), "MThd");
  // header length field must be 6
  const headerLen =
    (buf[4] << 24) | (buf[5] << 16) | (buf[6] << 8) | buf[7];
  eq(headerLen, 6);
  // at least chords + bass + drums + melody tracks
  let tracks = 0;
  for (let i = 0; i + 4 < buf.length; i++) {
    if (
      buf[i] === 0x4d &&
      buf[i + 1] === 0x54 &&
      buf[i + 2] === 0x72 &&
      buf[i + 3] === 0x6b
    ) {
      tracks++;
    }
  }
  ok(tracks >= 4, `tracks ${tracks}`);
});

test("MIDI is deterministic for the same project", async () => {
  const a = new Uint8Array(await (await exportMidi(P)).arrayBuffer());
  const b = new Uint8Array(await (await exportMidi(P)).arrayBuffer());
  eq(a.length, b.length);
  eq([...a.slice(0, 64)], [...b.slice(0, 64)]);
});

test("MIDI carries no audio: sampled slots export as plain notes", async () => {
  // Default project already uses the sampled Grand Piano.
  const blob = await exportMidi(P);
  const buf = new Uint8Array(await blob.arrayBuffer());
  eq(String.fromCharCode(...buf.slice(0, 4)), "MThd");
  const text = new TextDecoder("latin1").decode(buf);
  ok(!text.includes("/samples/") && !text.includes("grand-piano"), "no audio refs");
});

suite("PDF export data");

test("section timeline is monotonic and complete", () => {
  const tl = sectionTimeline(P);
  eq(tl.length, P.arrangement.length);
  eq(tl[0].start, "0:00");
  eq(
    tl.map((s) => s.name),
    P.arrangement.map((s) => s.name)
  );
  const toSec = (mmss: string) => {
    const [m, s] = mmss.split(":").map(Number);
    return m * 60 + s;
  };
  for (let i = 1; i < tl.length; i++) {
    ok(toSec(tl[i].start) >= toSec(tl[i - 1].start), `order at ${i}`);
  }
});

test("export produces a real PDF document", async () => {
  const blob = await exportPdf(P);
  ok(blob.size > 1000, `size ${blob.size}`);
  const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
  eq(String.fromCharCode(...head), "%PDF-");
});

suite("PDF production-notes accuracy");

function pdfText(blob: Blob): Promise<string> {
  // jsPDF encodes text as UTF-16BE: strip nulls before asserting.
  return blob.arrayBuffer().then((ab) => {
    const bytes = new Uint8Array(ab).filter((b) => b !== 0);
    return new TextDecoder("latin1").decode(bytes);
  });
}

test("obsolete processing claims stay out of the blueprint", async () => {
  const text = (await pdfText(await exportPdf(P))).toLowerCase();
  for (const stale of ["side-chain", "sidechain", "humanize hats", "2:1 for modern glue"]) {
    ok(!text.includes(stale), `absent: ${stale}`);
  }
});

test("production notes describe feel without inventing processing", async () => {
  const text = await pdfText(await exportPdf(P));
  ok(text.includes("Expressive"), "names all four feel levels");
});

suite("originality wording");

test("variety finding makes no absolute uniqueness claim", async () => {
  const { checkOriginality } = await import("@/lib/originality");
  const findings = checkOriginality(P);
  const variety = findings.find((f) => f.title === "Tune has variety");
  ok(variety, "variety finding present");
  ok(!variety!.detail.includes("Nothing here repeats word-for-word"), "no absolute claim");
  ok(variety!.detail.includes("No repeated-melody flag was detected"), "evidence-based wording");
});
