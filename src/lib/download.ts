/** Hand the browser a file — a Blob behind a one-shot anchor click. */
export function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the click has started the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadJson(fileName: string, data: unknown): void {
  downloadBlob(fileName, new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
}

export function downloadText(fileName: string, text: string, type = "text/plain"): void {
  downloadBlob(fileName, new Blob([text], { type }));
}
