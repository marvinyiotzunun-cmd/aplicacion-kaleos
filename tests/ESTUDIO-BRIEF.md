# Brief del Estudio de diseños de Kaleos

Kaleos es la app de la Iglesia de Dios E.C. «La Línea» (Quetzaltenango, Guatemala). El pastor comparte por WhatsApp
tres tipos de imagen: **tarjetas** de felicitación (cumpleaños, aniversario de bodas, logros), **avisos** de eventos
(cultos, vigilias, discipulado, jóvenes) y **versículos** (saludo de buenos días con un texto bíblico RV60).

El dueño dijo: «los diseños son todos genéricos, hazme diseños que no parezcan hechos por una IA… imitando lo que hacía
el diseño en Adobe Spark». Los diseños viejos (docs/js/core.js `art`, `drawVerse`, `drawAnn`; docs/js/cards.js) usan
siempre la misma serif cursiva centrada sobre un degradado con brillo: eso es exactamente lo que NO queremos.

## Qué era Adobe Spark Post (la referencia, sin copiar nada concreto)
- La tipografía ES el diseño: mezcla de 2 o 3 letras con mucho contraste (palo seco condensada y pesada + caligrafía
  o serif de exhibición + una de texto pequeña con espaciado amplio).
- Escalas muy distintas: una palabra enorme, otra pequeñita. Jerarquía clara en un vistazo.
- Composiciones con intención: alineadas a la izquierda, asimétricas, en bloques de color, texto dentro de una
  forma (cinta, círculo, sello, caja), texto con contorno, palabra que se monta sobre otra.
- Paletas cortas (2–3 colores planos y decididos), nada de degradados arcoíris ni brillos.
- Foto de fondo con un tratamiento (duotono, blanco y negro, velo de color, marco) cuando hay foto.
- Detalles «hechos a mano»: trazo de pincel, subrayado de marcador, cinta adhesiva, papel, grano, sellos.

## Lista contra «se ve hecho por IA» (cada plantilla debe pasarla)
1. Nada de degradado radial con resplandor al centro, ni bokeh, ni rayos de luz, ni «cielo mágico».
2. Nada de todo centrado y simétrico por defecto. Si centras, que sea una decisión (p. ej. sello o medalla).
3. Máximo 3 colores por tema más blanco/negro. Colores planos, con textura (papel, grano) y no plástico.
4. Tipografía con carácter y contraste de escala real (la palabra grande al menos 3× la pequeña).
5. Un solo gesto «a mano» protagonista por pieza (pincel, cinta, sello, marcador); no todos a la vez.
6. Márgenes generosos y alineación consistente; respira. Nada amontonado ni texto flotando al azar.
7. Debe verse bien con textos cortos Y largos (nombres de 40 letras, títulos de 60, versículos de 150).
8. Legible en el celular: el texto principal se lee en miniatura de 270 px de ancho. Contraste alto.

## Datos que recibe cada plantilla (`g.d`)
- `g.d.kind`: "card" | "ann" | "verse". `g.d.church` = "Iglesia de Dios E.C. · La Línea", `g.d.churchShort` = "La Línea".
- card: `kicker` (fecha, p. ej. "7 de noviembre"), `headline` ("¡Feliz cumpleaños!", "¡Feliz aniversario de bodas!",
  "¡Felicidades!"…), `name` ("Hno. Luis Ajú" hasta "Hna. María Fernanda López de García"), `line` (frase corta),
  `verse` + `ref` (versículo y cita), `signature` ("Pastor Marvin Miche"), `from` ("y toda la familia de La Línea"),
  `occasion` ("cumple" | "bodas" | "otro").
- ann: `title`, `place` (puede venir vacío), `date` (Date o null: ¡puede no haber fecha!), `day` ("14"), `month`
  ("noviembre"), `weekday` ("sábado"), `time` ("6:00 p. m."), `when` ("sábado 14 de noviembre").
- verse: `text`, `ref`, `head` (opcional, p. ej. "¡Buenos días, iglesia!"), `eyebrow` (opcional), `firma` (bool: poner
  la línea de la iglesia abajo). `g.fmt` = "cuadrado" (1080×1080) | "post" (1080×1350) | "historia" (1080×1920).
- Tarjetas y avisos miden 1080×1350. Usa `g.W` y `g.H`, nunca números fijos de alto para el versículo.

## API (docs/js/estudio.js — léelo entero; NO lo modifiques)
`K.EST.add({ id, name, family, fonts: [...], themes: { clave: { name, ...colores } }, draw(g) })`
Ayudantes en `g`: `F(fam, size, weight, italic)`, `measure`, `wrap`, `fit(texto, size=>font, {maxW,maxH,maxLines,start,min,lh,sp})`,
`text(s,x,y,{font,color,align,sp,alpha,stroke,strokeW,shadow,rotate})`, `lines`, `paper(color,{fibers,grain,vignette,mottle})`,
`grain`, `vignette`, `brush`, `scribble`, `roughRect`, `roughCircle`, `wash`, `torn`, `halftone`, `tape`,
`photo(x,y,w,h,{treat:"none|bn|duo|calido|suave",dark,light,tint,path,focusX,focusY,blur})` (devuelve false si no hay foto),
`logo(x,y,h,{white,align,alpha})`, `round`, `splitHead`, `splitVerse`, `rgba`, `mix`, `lum`, `R()` (azar con semilla: úsalo,
nunca `Math.random`), `ctx` (canvas 2D, puedes dibujar lo que quieras: formas, ilustraciones vectoriales sencillas).
Tipografías disponibles (solo estas): ver `FONT_FILES` en estudio.js. Declara en `fonts` las que uses.
`g.photoOn` es true cuando el pastor eligió una foto (`g.img`).

## Reglas
- Ejemplo de referencia: docs/js/estudio/tipografica.js (plantilla «tip-cartel»). Mira su código y su hoja de muestra.
- Cada plantilla dibuja los TRES tipos y los tres formatos de versículo. 5 temas de color por plantilla, con nombres en
  español («Marino y oro», «Terracota»…). Incluye siempre un tema con los colores de La Línea (azul marino #0d1b3d /
  #2d5fa8 con dorado #f2c85b) y al menos un tema claro.
- El logo (`g.logo`) va pequeño y discreto; `white:true` sobre fondos oscuros.
- Iconografía permitida: cruz sencilla, paloma, rama de olivo, trigo, sol, montañas, flores, globos/confeti con mesura
  en cumpleaños, anillos en bodas. Nunca personas ni niños dibujados. Todo en español con tildes y ¡¿.
- Rendimiento: cada imagen < 400 ms. Sin red, sin imágenes externas.
- Si hay foto (`g.photoOn`), úsala con un tratamiento que case con la plantilla; si no hay, la plantilla debe verse
  completa y bonita sin ella (no dejes un hueco gris).
- Textos en código y comentarios en español sencillo, como en el resto del proyecto.
- NO edites estudio.js, ni archivos de otras familias, ni hagas git commit.

## Cómo revisar tu trabajo
`node tests/estudio-sheet.js <carpeta-salida> <familia>` dibuja cada plantilla × tema × (2 tarjetas, 3 avisos, 3 versículos)
en `<id>.png` y un ejemplo grande `<id>-grande.jpg`; añade `--photo` para probar con una foto de prueba (`<id>-foto.png`).
Sale con error si algo falla o si un texto se sale de la imagen. MIRA las imágenes (herramienta Read) y corrige hasta que
estés orgulloso: compara contra la lista anti-IA, contra textos largos y contra la foto.

## Ids
Cada id empieza con el prefijo de su familia: tip-, edi-, man-, pap-, fie-, fot-, sag- (p. ej. «edi-revista»).
Una vez publicado, un id no se cambia (queda guardado en los avisos y tarjetas enviados).
