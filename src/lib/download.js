// Triggers a browser download of `bytes` saved as `filename`.
export function downloadBytes(bytes, filename, type = 'application/pdf') {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  // Revoke after the click is processed; doing it synchronously can cancel the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
