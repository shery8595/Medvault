import pdfParse from "pdf-parse/lib/pdf-parse.js";

/** Extract plain text from a PDF buffer. Caller must discard buffer after redaction. */
export async function pdfBufferToText(buffer: Buffer): Promise<string> {
  const result = await pdfParse(buffer);
  const text = (result.text ?? "").trim();
  if (!text) {
    throw new Error("PDF contained no extractable text");
  }
  return text;
}
