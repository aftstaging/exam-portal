import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { AFT_LOGO_BASE64 } from "./aftLogo";

type PrintableExam = { title: string; intro: string | null; totalDurationSeconds: number };
type PrintableSection = { sectionNumber: number; title: string; durationSeconds: number; introduction: string | null };

export async function generateBrandedPrintablePdf(exam: PrintableExam, sections: PrintableSection[]) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 595;
  const pageHeight = 842;
  let page = document.addPage([pageWidth, pageHeight]);
  let y = 790;
  const violet = rgb(0.047, 0.02, 0.141);
  const cyan = rgb(0, 0.72, 0.85);
  const mint = rgb(0, 0.78, 0.45);
  const addPage = () => { page = document.addPage([pageWidth, pageHeight]); y = 790; };
  const line = (text: string, font = regular, size = 10, color = violet, indent = 48) => {
    const words = text.split(/\s+/); let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > pageWidth - indent - 48) { if (y < 60) addPage(); page.drawText(current, { x: indent, y, size, font, color }); y -= size + 5; current = word; } else current = next;
    }
    if (current) { if (y < 60) addPage(); page.drawText(current, { x: indent, y, size, font, color }); y -= size + 5; }
  };
  page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 0, y: 770, width: pageWidth, height: 72, color: violet });
  const logo = await document.embedPng(Buffer.from(AFT_LOGO_BASE64, "base64"));
  const scale = Math.min(120 / logo.width, 36 / logo.height);
  page.drawImage(logo, { x: pageWidth - 48 - logo.width * scale, y: 790, width: logo.width * scale, height: logo.height * scale });
  page.drawText("ACCOUNTANTS FOR TOMORROW", { x: 48, y: 808, size: 15, font: bold, color: rgb(1, 1, 1) });
  page.drawText("PRINTABLE MOCK EXAM", { x: 48, y: 787, size: 9, font: bold, color: cyan });
  y = 730;
  line(exam.title, bold, 20, violet);
  line(`Total duration: ${Math.round(exam.totalDurationSeconds / 60)} minutes`, bold, 11, mint);
  y -= 10;
  line("AFT-created printable exam document. Use the protected published question paper and permitted resources for the full assessment content.", regular, 10);
  line("Protected resources referenced by this document: question paper, pre-seen material, formulae + tables, reference material, and email attachment where published for this exam.", regular, 10, violet);
  line("Question metadata: each timed section below represents the corresponding case-study task in the selected mock-exam record.", regular, 10, violet);
  y -= 10;
  for (const section of sections) {
    if (y < 110) addPage();
    page.drawRectangle({ x: 42, y: y - 8, width: pageWidth - 84, height: 28, color: violet });
    page.drawText(`SECTION ${section.sectionNumber} · ${section.title}`, { x: 52, y: y, size: 10, font: bold, color: rgb(1, 1, 1) });
    y -= 28;
    line(`${Math.round(section.durationSeconds / 60)} minutes`, bold, 10, mint);
    line(section.introduction ?? "Refer to the protected question paper for the complete case-study task and instructions.", regular, 10);
    y -= 8;
  }
  line("Candidate notes", bold, 12, violet);
  line("Write your responses in the online answer pad or on the printed answer pages supplied with this document. Keep your work secure and follow the exam administrator's submission instructions.", regular, 10);
  for (let i = 0; i < 3; i++) { if (y < 90) addPage(); page.drawLine({ start: { x: 48, y }, end: { x: pageWidth - 48, y }, thickness: 0.5, color: rgb(0.82, 0.82, 0.88) }); y -= 30; }
  return Buffer.from(await document.save());
}
