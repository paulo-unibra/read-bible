export const FocusPalette = {
  light: {
    blue: "#169fe6",
    blueDark: "#0879b6",
    blueSoft: "#eaf7fe",
    screen: "#ffffff",
    surface: "#f5f7f8",
    text: "#202326",
    muted: "#687077",
    line: "#e3e7e9",
    success: "#00a240",
    danger: "#e02e2a",
    warning: "#e25507",
  },
  dark: {
    blue: "#52b9ee",
    blueDark: "#83cfff",
    blueSoft: "#17394a",
    screen: "#101417",
    surface: "#1a2024",
    text: "#f2f5f7",
    muted: "#aab4bb",
    line: "#30383e",
    success: "#40c977",
    danger: "#ff6764",
    warning: "#ff8549",
  },
} as const;

export const FocusRadius = {
  sm: 14,
  md: 18,
  lg: 24,
  pill: 999,
} as const;

export const FocusShadow = {
  light: {
    shadowColor: "#1b2731",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 4,
  },
  dark: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 20,
    elevation: 4,
  },
} as const;

export function getFocusColors(isDark: boolean) {
  return isDark ? FocusPalette.dark : FocusPalette.light;
}

export function getFocusShadow(isDark: boolean) {
  return isDark ? FocusShadow.dark : FocusShadow.light;
}
