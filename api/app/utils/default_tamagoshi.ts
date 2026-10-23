import { randomInt } from 'node:crypto'

// Catalog version 2; kept aligned with the app by the catalog regression test.
const names = [
  'Pipo',
  'Lumi',
  'Nino',
  'Tito',
  'Mimi',
  'Nuvem',
  'Mel',
  'Pipoca',
  'Rubi',
  'Tico',
  'Bao',
  'Euca',
  'Kiwi',
  'Floe',
  'Fubá',
  'Pérola',
  'Cacau',
  'Sol',
  'Maple',
  'Paçoca',
  'Yuki',
  'Cinza',
  'Broto',
  'Polo',
  'Bento',
  'Flora',
  'Tobias',
  'Lilo',
  'Caju',
  'Floquinho',
  'Kiko',
  'Otto',
  'Jade',
  'Neve',
  'Amora',
  'Algodão',
  'Avelã',
  'Dourado',
  'Aurora',
  'Bolota',
  'Mei',
  'Kiara',
  'Trevo',
  'Nalu',
  'Faísca',
  'Biscoito',
  'Bambu',
  'Koda',
  'Zeca',
  'Pingo',
] as const

export function defaultTamagoshi() {
  const seed = randomInt(2147483647)
  let hash = 2166136261
  for (const char of `readbible-companion-v1:${seed}`)
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return { seed, name: names[(hash >>> 0) % names.length], catalog_version: 2 }
}
