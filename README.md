# Kaleos

App de cuidado pastoral de la **Iglesia de Dios Evangelio Completo de La Línea**: tarjeta de membresía con QR, asistencia por escaneo del ujier, camino del hermano (visitante → líder), cumpleaños con «Pedir oración», reverso con misión, aviso y predicación, panel del pastor (Cuidar, Formar, Reportar), Saludos del pastor (tarjetas personalizadas por cumpleaños, aniversarios y fechas especiales, enviadas por WhatsApp) y reporte mensual al Supervisor de Distrito.

## Cómo está hecha
- `docs/`: la app (PWA, HTML + JS sin compilación). Funciona sola en cualquier hosting estático e incluye `docs/config.js`.
- `server.js`: servidor opcional para Railway; sirve `docs/` y reemplaza `/config.js` con las variables `SUPABASE_URL` y `SUPABASE_ANON_KEY`.
- `supabase/migrations/`: tablas `kaleos_*` con RLS y funciones (asistencia, panel, reporte).
- `supabase/functions/kaleos-admin/`: alta de hermanos y cambio de PIN (usa la clave de servicio).

## Roles
- **Miembro**: ve su tarjeta, su camino, el reverso y pide oración.
- **Ujier**: además escanea los códigos al entrar.
- **Pastor**: panel, hermanos, saludos, escaneo, avisos, datos de la iglesia y reporte.

## Inicio de sesión
Número de miembro (por ejemplo `LL-0001`) y un PIN de 6 números que entrega el pastor. No hace falta correo.

## Publicación en GitHub Pages
En GitHub: Settings → Pages → Deploy from a branch → `main` / `/docs`.
Queda en https://marvinyiotzunun-cmd.github.io/aplicacion-kaleos/

## Publicación en Cloudflare Pages
Cloudflare Pages está conectado a este repositorio: cada cambio en `main` se publica solo en https://aplicacion-kaleos.pages.dev
Configuración: sin comando de compilación, directorio de salida `docs`.
Para volver a una versión anterior: Cloudflare → Workers y Pages → aplicacion-kaleos → Implementaciones → «Revertir», o revertir el cambio en GitHub.
