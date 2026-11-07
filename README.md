# Kaleos

App de cuidado pastoral de la **Iglesia de Dios Evangelio Completo de La Línea**: tarjeta de membresía con QR, asistencia por escaneo del ujier, camino del hermano (visitante → líder), cumpleaños con «Pedir oración», reverso con misión, aviso y predicación, panel del pastor (Cuidar, Formar, Reportar), Saludos del pastor (tarjetas personalizadas por cumpleaños, aniversarios, fechas especiales, invitaciones y recordatorios, enviadas por WhatsApp, correo o al buzón «Mensajes» de la app) y reporte mensual al Supervisor de Distrito.

## Cómo está hecha
- `docs/`: la app (PWA, HTML + JS sin compilación). Funciona sola en cualquier hosting estático e incluye `docs/config.js`.
- `server.js`: servidor opcional para Railway; sirve `docs/` y reemplaza `/config.js` con las variables `SUPABASE_URL` y `SUPABASE_ANON_KEY`.
- `supabase/migrations/`: tablas `kaleos_*` con RLS y funciones (asistencia, panel, reporte).
- `supabase/functions/kaleos-admin/`: alta de hermanos y cambio de PIN (usa la clave de servicio).

## Pruebas
`npm test` (o `node tests/e2e.js`) abre la app en Chromium con un Supabase simulado (`tests/mock-supabase.js`) que copia las reglas de la base (RLS), sus restricciones y funciones, y prueba cada sección con las tres cuentas de ejemplo, en celular y computadora, con tema claro y oscuro. No toca la base real.
- Solo una parte: `node tests/e2e.js pastor` (filtra por nombre de prueba).
- Con capturas: `SHOTS=1 node tests/e2e.js` (quedan en `tests/shots/`).
- Necesita Node 18+ y Playwright (`npm i -D playwright && npx playwright install chromium`).

## Asistente y diseños
- `docs/js/cerebro.js`: el asistente entiende sin internet fechas («el sábado a las 7», «el 15 de noviembre»), horas, nombres de hermanos, comunidades, citas bíblicas y temas («un versículo de paz»). Con la clave de OpenAI, ChatGPT elige de la misma lista de acciones (`supabase/functions/kaleos-asistente`).
- `docs/js/iglesia.js`: lo que Kaleos sabe de La Línea (lema, reuniones fijas, calendario, tema del mes, saludo del pastor y reglas). Las fechas de la Semana de Oración, Misiones y Discipulado se calculan solas. Edite aquí los horarios cuando cambien.
- Diseños: 13 fondos × 17 colores × 5 composiciones = 1.105 por tipo (versículos, avisos y tarjetas), más 6 tarjetas clásicas (Azul y Rosa como las de La Línea).

## Roles
- **Miembro**: ve su tarjeta, sus mensajes del pastor, su camino, el reverso y pide oración.
- **Pastor**: asistente, versículos, pedidos, agenda, hermanos, comunidades, saludos, mayordomía (para dar), controles de solo lectura, reporte y datos de la iglesia.
- **Secretaría** (Kaleos Central): personas, comunidades, turnos de servicio, avisos, informes, asistencia, reporte y mayordomía (confirmar y registrar aportes, proyectos).
- **Ujier** (perfil antiguo, aún admitido): además escanea los códigos al entrar.

## Inicio de sesión
Número de miembro (por ejemplo `LL-0001`) y un PIN de 6 números que entrega el pastor. No hace falta correo.

## Publicación en GitHub Pages
En GitHub: Settings → Pages → Deploy from a branch → `main` / `/docs`.
Queda en https://marvinyiotzunun-cmd.github.io/aplicacion-kaleos/

## Publicación en Cloudflare Pages
Cloudflare Pages está conectado a este repositorio: cada cambio en `main` se publica solo en https://aplicacion-kaleos.pages.dev
Configuración: sin comando de compilación, directorio de salida `docs`.
Para volver a una versión anterior: Cloudflare → Workers y Pages → aplicacion-kaleos → Implementaciones → «Revertir», o revertir el cambio en GitHub.
