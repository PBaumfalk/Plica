import "server-only";

/** Content-Disposition mit ASCII-Fallback und RFC-5987-Dateinamen. */
export function contentDisposition(filename: string, inline = false) {
  const ascii = filename.normalize("NFKD").replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "").replace(/[\r\n]/g, "") || "download";
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
