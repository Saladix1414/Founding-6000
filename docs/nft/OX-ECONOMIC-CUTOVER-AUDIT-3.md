# Founding 6000 — reconciliación de política económica, fase 3

**Estado:** `READ_ONLY_AUDIT_PREPARED` / `NOT_APPROVED_FOR_CUTOVER_OR_TRANSACTIONS`.

Se han detectado dos generaciones de reglas: las históricas V2/V3 (25% de reservas y tratamiento especial del token #0001) y la propuesta comercial V4 (50% de ventas a reserva, todos los 6.000 tokens comercializables y futuras contribuciones del 15% de beneficios netos). **No se deben reinterpretar en silencio asientos anteriores:** cada movimiento conserva su `policy_version` y sus importes originales hasta disponer de evidencia y una política de ajuste explícita.

## Archivos

- `cloudflare/oxEconomicCutoverAudit.mjs`: lector interno para el Durable Object SQLite, sin nuevas rutas ni escrituras.
- `scripts/auditFoundingPolicySources.mjs`: detector estático de incompatibilidades de códigos de venta, NFT #0001 y preparación de rescate.
- `tests/oxEconomicCutoverAudit.test.mjs`, `tests/oxEconomicPolicySources.test.mjs`: pruebas con SQLite temporal y fuentes simuladas; ninguna operación real.

## Auditoría contable local

`auditFoundingEconomicCutover({ storage })` lee solamente `founding_orders`, `founding_memberships`, `inventory_allocations`, `payment_settlements`, `payment_attempts` y, si están presentes, `ox_reserve_movements`, `ox_redemption_requests` y `nft_release_assets`.

Para contar una venta internamente verificada exige: una relación no ambigua orden→membresía→serial→asignación→intento→liquidación, orden `PAID`, intento `VERIFIED`, cadena Ethereum 1, 12 confirmaciones registradas, USDT Ethereum con 6 decimales, contrato y receptor compatibles, transacción en la asignación igual a la del pago, y cantidad igual al precio del tramo (RARE 50, EPIC 70, LEGENDARY 90 USDT). Si aparecen discrepancias o datos incompletos, la venta no incrementa las cifras verificadas y aparece un código de incidencia.

El informe **no expone emails** ni direcciones de compradores. Devuelve importes como strings en unidades mínimas de USDT y un `reportHash` SHA-256 reproducible del snapshot. Los 50% `hypothetical50PercentReserveMinorForAlreadyPaidOrders` son **proyección ilustrativa para comparar políticas**, **no** un saldo real o obligación ya reconocida. Los apuntes de reservas se agrupan por versión sin modificarse. Detecta asientos sin vínculo a ventas o múltiples devengos de una misma venta.

Limitaciones explícitas:

1. Las confirmaciones y pagos provienen de **registros internos**, no de una lectura independiente de la cadena en ese instante.
2. El histórico anterior del backend `server/src/services/reserveService.ts` puede estar en otra base. Esta auditoría NO lo ha conciliado: siempre devuelve `oldServerLedgerIndependentlyReconciled:false`.
3. El importe en `ox_reserve_movements` no demuestra custodia efectiva. No se verifica el vault, titular de la billetera, inversiones, pasivos, liquidez en Base, ni disponibilidad de fondos.
4. El estado se mantiene bloqueado incluso con cero incidencias, porque la activación del modelo requiere aprobaciones adicionales.
5. El auditor no se expone en una ruta pública. Una futura API de transparencia deberá ser agregada con autorización, controles de acceso y ocultación de información personal.

## Propuesta de corte

`buildEconomicCutoverProposal({ audit, expectedReportHash, effectiveAfterUtc })` produce un objeto con hash anclado al reporte, fecha indicativa y tareas de desbloqueo. Nunca escribe en DB ni devuelve autorización. La fecha **no** activa el nuevo modelo; es un valor para una futura aprobación manual que precisará corte de liquidaciones, política firmada, prueba de custodia y reconciliación histórica.

**No efectuar backfill automático del 50%** sobre ventas históricas de 25%. Se necesitaría clasificar cada venta bajo la política aplicable en su fecha y, si hay nuevas obligaciones, registrarlas con asientos de ajuste autorizados y con documentación de origen.

## Auditoría de compatibilidad de código

Desde la raíz del repo:

```bash
node scripts/auditFoundingPolicySources.mjs
node scripts/auditFoundingPolicySources.mjs --json
```

Se comprueba el borrador 50%, 6.000 disponibles, el cálculo de UI y las exclusiones que siguen en `rareReleaseInventory.mjs`, `nftPaidDeliveryIntent.mjs` y `nftPostSaleRedemptionPreparation.mjs`. Aunque las tres compatibilidades pasasen en una versión futura, un resultado positivo **no equivaldría a autorización de apertura comercial**. El modo `--enforce` devuelve estado de error mientras existan incompatibilidades de código.

## Requisitos para una migración real (posterior)

- Exportar/verificar todos los cobros, reservas y asientos previos; establecer el último settlement bajo la política anterior y asegurar continuidad de IDs, replays y reembolsos.
- Resolver la falta de asset aprobado y entrega de #0001 sin alterar identidades, metadata, imágenes o tokens ya vendidos.
- Aprobar formalmente la política V4, su versión/hash, fecha efectiva y excepciones contractuales de órdenes anteriores.
- Implementar el reparto aprobado (no confundir un 50% de devengo con un saldo on-chain), intereses/pérdidas por inversión comunitaria, custodia identificada y conciliada.
- Definir derechos de rescate legalmente ejecutables, supply denominador y activos de pago en Base. El pago USDT actual está en Ethereum; no hay atomicidad entre redes.
- Realizar pruebas de migración, replay, finality, reversión, custodia, seguridad y revisión legal antes de habilitar cualquier movimiento.

**Sin `git push`, `wrangler deploy`, señales de producción, acceso a secretos, firmas ni transferencias.**
