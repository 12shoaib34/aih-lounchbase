export function invoiceDownloadError(failure: unknown) {
  const message = failure instanceof Error ? failure.message : "";
  return /dynamically imported module|importing a module|module script|preload css/i.test(
    message,
  )
    ? "An update interrupted PDF loading. Save your draft, then refresh to download."
    : "PDF download failed. Your invoice is unchanged; try again.";
}
