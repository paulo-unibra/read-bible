# Arte do certificado

Fundo: `assets/certificates/classic-background.png`, criado com a ferramenta integrada Imagegen a partir da referência visual fornecida pelo usuário. O arquivo é distribuído com o app e embutido no PDF, para funcionar offline. A foto captura o mesmo componente da prévia. Campos pessoais e datas são texto dinâmico, não fazem parte da imagem.

Fonte: Cormorant Garamond, com licença SIL Open Font License preservada em `assets/fonts/CertificateSerif-OFL.txt`. A interface usa arquivos estáticos regular, bold e italic do projeto oficial https://github.com/CatharsisFonts/Cormorant. Cada face usa um nome próprio no Expo para evitar substituição por fonte de sistema no Android. O PDF incorpora a versão variável da fonte.

A imagem nativa tem largura e altura explícitas de 842 × 595 antes da redução para a tela; somente `absoluteFill` pode deixar o tamanho intrínseco do bitmap prevalecer no Android.

## Prompt usado na geração

Create a production-ready blank ornamental background for a personalized Bible reading completion certificate, inspired by the reference image in the conversation. Landscape A4 ratio 1.414:1, high resolution. Flat perfectly straight-on graphic artwork, not a photographed mockup. Warm ivory parchment with subtle fine paper texture, thin double inset rectangular border in deep olive green and antique gold with elegant curved corner ornaments, realistic watercolor olive branches concentrated in the four corners, very faint biblical hillside and cypress landscape fading into the lower left and right margins. Small beautifully engraved open Bible emblem with delicate golden rays and olive branches centered at x50% y11%. Small antique gold embossed scalloped medal with botanical wreath and tiny crown centered at x50% y86%, with a blank smooth center for dynamic year text. Leave the entire central text area x12%-88%, y19%-75% clean and pale for programmatically overlaid text. Leave bottom left x12%-35% y85%-92% and bottom right x67%-88% y85%-92% unobstructed for date and issuer. Extremely polished traditional Christian ceremonial certificate, restrained and detailed, print-ready. NO TEXT anywhere: no letters, no names, no dates, no numbers, no signatures, no placeholder labels, no watermark. The border and foliage must never intrude on the central text area. Match the reference green/gold/ivory visual character. This is a background template asset used in a real app, not a finished personalized certificate.

## Variações anuais

A paleta é definida pelo ano da conclusão em America/Recife, e não pelo ano escrito no nome do plano nem pelo ano atual. 2026 e anteriores mantêm o clássico. A partir de 2027, o ciclo de quatro paletas é azul/prata, vinho/dourado, roxo/prata, verde/dourado, repetindo nessa ordem. Assim, abrir um certificado antigo em outro ano preserva a identidade dele.

Artes adicionais, geradas com a ferramenta integrada Imagegen a partir do fundo clássico, sem texto:

- `assets/certificates/blue-background.png`: 2027, azul-marinho e prata antiga.
- `assets/certificates/burgundy-background.png`: 2028, vinho e dourado antigo.
- `assets/certificates/purple-background.png`: 2029, roxo e prata antiga.

Os textos, linhas e cores do nome acompanham cada paleta. A prévia e o canvas de exportação usam a mesma seleção. O cache de arte do PDF web é separado por paleta, evitando reutilizar a imagem de outro ano.

### Prompt das variações

Prompt-base de edição: “Edit this certificate background ONLY to produce a color variation for year YEAR. Palette: PALETTE. This is a production asset whose text is overlaid at fixed coordinates. CRITICAL preserve EXACTLY the original composition, proportions, landscape A4 aspect ratio, all border positions, all foliage geometry, the open Bible at the top, the bottom medal size/shape/position and its blank center, crown, every ornament, the subtle landscape, the texture, all whitespace. Do not move, add, remove, or resize anything. Only recolor the existing pixels/artwork. Maintain gentle watercolor shading, realistic engraved metal detail, excellent contrast with future dark text, and restrained elegant colors. No text, no letters, no years, no numbers, no signature, no watermark. Return only the full flat certificate background, no frame outside it, no mockup.”

Substituições de PALETTE:

- 2027: “navy blue and antique silver; replace olive-green ink/foliage with muted blue-slate and all gold metal ornaments with engraved antique silver, ivory-white parchment”.
- 2028: “deep burgundy wine and antique rose gold; replace olive-green ink/foliage with muted burgundy and warm bronze-red foliage accents, retain rich warm antique gold metal ornaments, warm ivory parchment”.
- 2029: “deep royal plum purple and antique silver; replace olive-green ink/foliage with restrained plum-purple and dusty lavender, gold metal ornaments become antique silver, pale ivory parchment”.
