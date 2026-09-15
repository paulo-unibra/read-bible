export function formatBibleAbbreviation(abbreviation?: string | null): string {
  if (!abbreviation) return "";

  return abbreviation.replace(/^POR/i, "");
}
