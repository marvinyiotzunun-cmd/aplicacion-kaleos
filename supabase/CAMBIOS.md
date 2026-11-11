# Registro de cambios de Kaleos en Supabase

Proyecto: **salones-tecnoia** (`mvhdmqhmgmtpwknluzuk`, desde el 2026-11-11). Kaleos usa solo las tablas `public.kaleos_*`; las demás tablas del proyecto son de otra app y no se tocan.

El proyecto anterior (`yjjnvteobvguhlfeexti`) dejó de existir. El 2026-11-11 se instaló todo de nuevo en el proyecto nuevo: scripts 1 a 7, las tres funciones y la precarga de La Línea (32 hermanos y 39 fechas, por confirmar, que no está en GitHub porque lleva teléfonos). No se copiaron los datos de prueba (cuentas LL-0001 a LL-0003 ni proyectos de ejemplo).

Cómo se usa: cada script SQL (`migrations/`) y cada función (`functions/`) tiene una línea aquí. Lo nuevo se agrega con estado **pendiente**; al aplicarlo se cambia a **aplicado** con la fecha.

## Scripts SQL (en orden)

| # | Archivo | Qué hace | Estado | Fecha |
| --- | --- | --- | --- | --- |
| 1 | `20261024000001_kaleos_esquema.sql` | Esquema base: iglesias, perfiles, asistencia, pasos, visitas, avisos, reportes | aplicado | 2026-11-11 |
| 2 | `20261026000001_kaleos_saludos.sql` | Saludos | aplicado | 2026-11-11 |
| 3 | `20261026000002_kaleos_mensajes.sql` | Mensajes y lecturas | aplicado | 2026-11-11 |
| 4 | `20261026000003_kaleos_pedidos.sql` | Pedidos (felicitación, visita, oración, otro) | aplicado | 2026-11-11 |
| 5 | `20261027000001_kaleos_asistencia.sql` | Confirmar asistencia a anuncios (`kaleos_rsvp`) | aplicado | 2026-11-11 |
| 6 | `20261028000001_kaleos_v2.sql` | Secretario-Tesorero, niveles, comunidades, versículos, agenda, bitácora, turnos y mayordomía | aplicado (sin proyectos de ejemplo) | 2026-11-11 |
| 7 | `20261107000001_kaleos_directorio.sql` | Directorio de hermanos y calendario de la iglesia | aplicado | 2026-11-11 |

Nota: en el proyecto nuevo los números 2 a 5 se corrieron juntos como SQL directo, y 6 y 7 juntos como la migración `kaleos_v2_directorio`.

## Edge Functions (verify_jwt activado)

| Función | Qué hace | Estado | Fecha |
| --- | --- | --- | --- |
| `kaleos-admin` | Alta de hermanos y cambio de PIN | aplicado | 2026-11-11 |
| `kaleos-asistente` | Asistente con IA (Claude de Anthropic desde el 2026-11-11) | aplicado | 2026-11-11 |
| `kaleos-voz` | Voz con IA | aplicado | 2026-11-11 |

## Secretos (Edge Functions → Secrets)

| Secreto | Lo usan | Estado |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | `kaleos-asistente` (y la voz básica, que pasa por el asistente) | pendiente en el proyecto nuevo (lo guarda Marvin) |
| `OPENAI_API_KEY` | `kaleos-voz` (voz en tiempo real; opcional: sin ella la app usa la voz del navegador) | no se usa por ahora |
| `KALEOS_SETUP_KEY` | `kaleos-admin` (solo para crear el primer pastor) | pendiente en el proyecto nuevo: hace falta para crear el primer pastor |

La clave nunca se escribe en este archivo.
