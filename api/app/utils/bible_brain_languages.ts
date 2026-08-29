export const LANGUAGE_NAMES: Record<string, string> = {
  por: 'Português',
  eng: 'Inglês',
  spa: 'Espanhol',
  fra: 'Francês',
  deu: 'Alemão',
  ita: 'Italiano',
}

export function displayLanguageName(iso: string | null, name: string | null) {
  if (iso && LANGUAGE_NAMES[iso]) return LANGUAGE_NAMES[iso]
  return name?.split(':')[0]?.trim() || iso || ''
}
