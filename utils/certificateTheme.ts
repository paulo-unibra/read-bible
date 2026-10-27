export const CERTIFICATE_THEMES = [
  {
    id: "classic",
    label: "Verde e dourado",
    ink: "#173520",
    accent: "#956b19",
    rule: "#ae8532",
    seal: "#4d3810",
    paper: "#faf5e8",
  },
  {
    id: "blue",
    label: "Azul e prata",
    ink: "#1b3554",
    accent: "#4d6078",
    rule: "#8496ab",
    seal: "#303c4a",
    paper: "#f5f6f7",
  },
  {
    id: "burgundy",
    label: "Vinho e dourado",
    ink: "#572431",
    accent: "#8a5025",
    rule: "#b38b52",
    seal: "#4d3810",
    paper: "#faf3ed",
  },
  {
    id: "purple",
    label: "Roxo e prata",
    ink: "#462953",
    accent: "#6f5484",
    rule: "#9a8ca8",
    seal: "#403447",
    paper: "#f7f3f8",
  },
] as const;

export function getCertificateYear(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    year: "numeric",
    timeZone: "America/Recife",
  }).format(new Date(date));
}

/** Stable annual rotation: opening an older award never changes its colors. */
export function getCertificateTheme(date: string) {
  const year = Number(getCertificateYear(date));
  const index = year <= 2026 ? 0 : (year - 2026) % CERTIFICATE_THEMES.length;
  return CERTIFICATE_THEMES[index];
}
