import { resolve } from "node:path";

import { PDFParse } from "pdf-parse";

let workerConfigured = false;

function configurePdfWorker() {
  if (workerConfigured) {
    return;
  }

  const workerPath = resolve(
    process.cwd(),
    "node_modules/pdf-parse/dist/pdf-parse/cjs/pdf.worker.mjs",
  );
  PDFParse.setWorker(workerPath);
  workerConfigured = true;
}

export async function extractTextFromPdfBuffer(fileBuffer: Buffer) {
  configurePdfWorker();

  const parser = new PDFParse({ data: fileBuffer });
  const parsed = await parser.getText();
  await parser.destroy();

  const normalized = parsed.text
    .replace(/\r/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return normalized;
}

export function selectRelevantKnowledgeContext(
  sourceText: string,
  userQuestion: string,
  maxChars = 12000,
) {
  if (!sourceText.trim()) {
    return "";
  }

  const chunks = sourceText
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 30);

  if (chunks.length === 0) {
    return sourceText.slice(0, maxChars);
  }

  const terms = userQuestion
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length >= 3);

  const ranked = chunks.map((chunk) => {
    const haystack = chunk.toLowerCase();
    const score = terms.reduce((total, term) => {
      if (!haystack.includes(term)) {
        return total;
      }

      const matches = haystack.split(term).length - 1;
      return total + matches;
    }, 0);

    return { chunk, score };
  });

  ranked.sort((a, b) => b.score - a.score);

  const selected: string[] = [];
  let usedChars = 0;

  for (const entry of ranked) {
    const nextSize = entry.chunk.length + (selected.length > 0 ? 2 : 0);
    if (usedChars + nextSize > maxChars) {
      continue;
    }

    selected.push(entry.chunk);
    usedChars += nextSize;

    if (usedChars >= maxChars * 0.9) {
      break;
    }
  }

  if (selected.length === 0) {
    return sourceText.slice(0, maxChars);
  }

  return selected.join("\n\n");
}