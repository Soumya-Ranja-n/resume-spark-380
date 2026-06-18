/**
 * Server-only resume text extraction. Filename ends in .server.ts so it never
 * ships to the browser bundle. Imported with dynamic import from server fns.
 */
export async function extractText(buffer: ArrayBuffer, fileName: string): Promise<string> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) {
    const { extractText: pdfExtract, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await pdfExtract(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n") : text;
  }
  if (lower.endsWith(".docx")) {
    const mammoth = (await import("mammoth")).default ?? (await import("mammoth"));
    const result = await (mammoth as { extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string }> }).extractRawText({
      buffer: Buffer.from(buffer),
    });
    return result.value;
  }
  if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    return new TextDecoder().decode(buffer);
  }
  throw new Error(`Unsupported file type: ${fileName}. Use PDF, DOCX, or TXT.`);
}
