# Registro de cambios de Kaleos en Supabase

Proyecto: **salones-tecnoia** (`yjjnvteobvguhlfeexti`). Kaleos usa solo las tablas `public.kaleos_*`.

Cómo se usa: cada script SQL (`migrations/`) y cada función (`functions/`) tiene una línea aquí. Lo nuevo se agrega con estado **pendiente**; al aplicarlo se cambia a **aplicado** con la fecha.

## Scripts SQL (en orden)

| # | Archivo | Qué hace | Estado | Fecha |
| --- | --- | --- | --- | --- |
| 1 | `20261024000001_kaleos_esquema.sql` | Esquema base: iglesias, perfiles, asistencia, pasos, visitas, avisos, reportes | aplicado | 2026-10-24 |
| 2 | `20261026000001_kaleos_saludos.sql` | Saludos | aplicado | 2026-10-26 |
| 3 | `20261026000002_kaleos_mensajes.sql` | Mensajes y lecturas | aplicado | 2026-10-26 |
| 4 | `20261026000003_kaleos_pedidos.sql` | Pedidos (felicitación, visita, oración, otro) | aplicado | antes del 2026-10-28 (comprobado el 2026-10-28) |
| 5 | `20261027000001_kaleos_asistencia.sql` | Confirmar asistencia a anuncios (`kaleos_rsvp`) | aplicado | antes del 2026-10-28 (comprobado el 2026-10-28) |
| 6 | `20261028000001_kaleos_v2.sql` | Secretario-Tesorero, niveles, comunidades, versículos, agenda, bitácora, turnos y mayordomía | aplicado | 2026-10-28 |

Nota: los números 4 y 5 no aparecen en el historial de migraciones de Supabase porque se corrieron como SQL directo; sus columnas y tablas sí existen. El número 6 se corrió desde el editor SQL del panel de Supabase.

## Edge Functions (verify_jwt activado)

| Función | Qué hace | Estado | Fecha |
| --- | --- | --- | --- |
| `kaleos-admin` | Alta de hermanos y cambio de PIN | aplicado (versión 2, usa columnas de v2) | 2026-10-28 |
| `kaleos-asistente` | Asistente con IA | aplicado (versión 1) | 2026-10-28 |
| `kaleos-voz` | Voz con IA | aplicado (versión 1) | 2026-10-28 |

## Secretos (Edge Functions → Secrets)

| Secreto | Lo usan | Estado |
| --- | --- | --- |
| `OPENAI_API_KEY` | `kaleos-asistente`, `kaleos-voz` | guardado por Marvin el 2026-10-28 |
| `KALEOS_SETUP_KEY` | `kaleos-admin` (solo para crear el primer pastor) | no guardado; no hace falta mientras la iglesia ya tenga pastor |

La clave nunca se escribe en este archivo.
