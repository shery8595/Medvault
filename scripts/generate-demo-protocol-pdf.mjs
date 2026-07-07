/**
 * Generates a sponsor trial protocol PDF for /sponsor/trials/create upload testing.
 * Usage: node scripts/generate-demo-protocol-pdf.mjs
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "fixtures");
const OUT_FILE = path.join(OUT_DIR, "sponsor-medvault-demo-protocol.pdf");

const LINES = [
  "MedVault Demo Protocol - Glycemic Control in Type 2 Diabetes",
  "Protocol ID: MV-DEMO-2026-001 | Version 1.0 | Phase 2",
  "",
  "Sponsor: Aurora Clinical Research (demo only)",
  "Principal Investigator: Dr. Jane Chen, MD",
  "Study contact: sponsor-demo@medvault.example | Tel: 555-010-2345",
  "Sample patient chart ref (PHI demo): MRN-884422, John Doe, DOB 03/15/1978",
  "",
  "1. Synopsis",
  "Randomized, double-blind, placebo-controlled study evaluating encrypted eligibility",
  "matching via MedVault fhEVM on Ethereum Sepolia. Duration: 12 weeks screening + 24 weeks treatment.",
  "",
  "2. Objectives",
  "Primary: Change in HbA1c from baseline to week 24.",
  "Secondary: Safety, quality-of-life, and sponsor incentive vault payout milestones.",
  "",
  "3. Inclusion Criteria",
  "Participants must meet ALL of the following:",
  "- Age between 25 and 60 years at informed consent.",
  "- Documented Type 2 diabetes mellitus for at least 6 months.",
  "- HbA1c <= 8.5% at screening (central lab).",
  "- Hemoglobin minimum 11.0 g/dL.",
  "- Female participants only (non-pregnant, non-lactating).",
  "- Height minimum 155 cm.",
  "- Weight maximum 100 kg.",
  "- Non-smokers only (no tobacco or nicotine in past 12 months).",
  "- Normal blood pressure (systolic < 140 mmHg and diastolic < 90 mmHg) without",
  "  adjustment of antihypertensive therapy within 30 days prior to screening.",
  "",
  "4. Exclusion Criteria",
  "- Type 1 diabetes or secondary diabetes.",
  "- Hemoglobin < 11.0 g/dL or active bleeding disorder.",
  "- Current smoker or vaping within 12 months.",
  "- Uncontrolled hypertension.",
  "",
  "5. Study Sites",
  "Remote-first enrollment with optional site visits in Boston, MA and Austin, TX.",
  "",
  "6. Compensation",
  "Participants receive confidential ETH micro-payments via MedVault Sponsor Incentive Vault",
  "upon milestone completion (screening, week 12, week 24).",
  "",
  "7. Regulatory",
  "Demo document only - not for human subjects. For MedVault sponsor UI and AI criteria extraction testing.",
];

function wrapLine(text, maxChars) {
  const words = text.split(/\s+/);
  const out = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      out.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) out.push(line);
  return out;
}

async function main() {
  const doc = await PDFDocument.create();
  doc.setTitle("MedVault Demo Sponsor Protocol");
  doc.setAuthor("MedVault");
  doc.setSubject("Sponsor trial creation demo PDF");

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const marginX = 54;
  const marginTop = 720;
  const marginBottom = 54;
  const lineHeight = 14;
  const maxChars = 92;

  let page = doc.addPage([612, 792]);
  let y = marginTop;

  const addWrapped = (text, opts = {}) => {
    const { size = 11, useBold = false, color = rgb(0.1, 0.12, 0.18) } = opts;
    const chunks = text === "" ? [""] : wrapLine(text, maxChars);
    for (const chunk of chunks) {
      if (y < marginBottom) {
        page = doc.addPage([612, 792]);
        y = marginTop;
      }
      if (chunk === "") {
        y -= lineHeight;
        continue;
      }
      page.drawText(chunk, {
        x: marginX,
        y,
        size,
        font: useBold ? bold : font,
        color,
      });
      y -= lineHeight;
    }
  };

  addWrapped(LINES[0], { size: 14, useBold: true });
  y -= 4;
  for (let i = 1; i < LINES.length; i++) {
    const line = LINES[i];
    if (line.startsWith("3. Inclusion") || line.startsWith("4. Exclusion")) {
      y -= 6;
      addWrapped(line, { useBold: true, size: 12 });
      continue;
    }
    addWrapped(line);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  // pdf-parse (pdf.js 1.x) cannot read PDF 1.7 object streams; keep output compatible.
  const bytes = await doc.save({ useObjectStreams: false });
  fs.writeFileSync(OUT_FILE, bytes);
  console.log(`Wrote ${OUT_FILE} (${bytes.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
