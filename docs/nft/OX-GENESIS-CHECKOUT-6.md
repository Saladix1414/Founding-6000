# OriginX Founding 6000 — checkout integrado en simulación V6

**Estado:** `INTERNAL_SIMULATION_READY` — **NO AUTORIZADO PARA VENTAS REALES**.
**Destino:** `deploy/cloudflare-d4`. Migración V5 debe existir en una base de ENSAYO antes de habilitar el modo opcional de `CommerceCore`.

## Integración

La V6 introduce `cloudflare/oxGenesisCheckoutV6.mjs`, un inventario operativo lateral para el serial `#0001`, con estados `AVAILABLE`, `RESERVED` y `ALLOCATED`. Guarda una huella del certificado V4 y la copia fija del snapshot V5. La nueva tabla `ox_genesis_checkout_events_v6` conserva los eventos de reserva y asignación con protección contra edición o borrado.

Se agregan puntos de extensión a `cloudflare/commerceCore.mjs`:

1. Constructor: opción interna `genesisCheckout`, **no** recibida desde HTTP.
2. `initializeRareRelease`: crea la tabla V6 únicamente si esa opción interna está presente y las dependencias V5 son coherentes.
3. `createOrder`: una compra simulada reserva primero #0001 si está disponible; la siguiente utiliza el inventario RARE preexistente #0002…#0101. La operación está dentro de la transacción de pedido del mismo `CommerceCore`.
4. `settleVerifiedUsdt`: reutiliza exactamente el intento USDT y su verificador preexistentes, con 12 confirmaciones y un solo `inventory_allocations` por serial. Para #0001 marca el nuevo inventario V6 `ALLOCATED` dentro de la **misma transacción** que el pago, la membresía y la cola de mint. Para los demás seriales se conserva `completeRareAllocation` V1.

La integración de prueba no crea una segunda orden, un segundo settlement ni una segunda membresía, y nunca hace `mint` ni activa una suscripción. El intento V5 de entrega pagada se prepara posteriormente, de forma separada, sólo con autenticación de wallet y verificación independiente de settlement; V6 no lo ejecuta automáticamente.

## Por qué NO se activa en producción

`cloudflare/foundingCore.mjs` sigue construyendo `CommerceCore` **sin** `genesisCheckout`. El archivo real `cloudflare/rareArcadeRelease.mjs` sigue con `approvedForSale:false`. Esta etapa **no cambia** `foundingCore.mjs`, `worker.mjs`, `wrangler.jsonc`, ni ninguna variable/env/secret; no hay `wrangler deploy`, apertura de ventas, despliegue ERC-721, transferencia ni emisión NFT. La política V6 exige `mode:'INTERNAL_REVIEW_ONLY'` y `salesActivationApproved:false` — es exclusivamente un protocolo de ensayo, no una política de lanzamiento.

## Preservación de datos

No se modifica `nft_release_assets` V1, `ox_release_assets_v5`, el candidato Genesis V4, metadata, hashes ni el contenido de órdenes existentes. La tabla V6 es **nueva** y sólo se puede crear tras comprobar las tablas V5 con certificado y snapshot aprobados. No hay `ALTER TABLE` ni eliminación de claves. SQLite `transactionSync` revierte todo si falla la inserción de evento, la asignación de inventario, la cola de mint, o el settlement.

El staging V5 no fue realizado automáticamente en la base de Cloudflare. El test de integración usa una BD SQLite en memoria: crea stock real de prueba con `rareArcadeRelease` copiada y habilitada sólo en ese proceso; fabrica pagos simulados, no transferencias blockchain. Quedan pendientes export/copia saneada de Durable Object productivo y una verificación independiente de custodia y contratos.

## Reglas bloqueantes para una futura V7 / producción

- Aprobación explícita y versionada de la política 50% de reserva, 15% de beneficios netos futuros, 10% máximo invertido tras votación, 90% líquido y **cero seriales reservados**; corte de histórico 25% por fecha sin reescribir asientos pasados.
- Comprobar que #0001 no tiene asignación ni entrega anterior; verificar certificado V4 con **bytes reales** y no sólo un objeto enviado por cliente.
- Preflight real de la base Durable Object: copia verificable, pagos parcialmente finalizados, idempotencia, duplicados, órdenes canceladas, reanudación y canary/rollback operativo. Las tablas laterales que llegaron a producción no deben borrarse a ciegas.
- RPC configurado y autenticado en el servidor, verificación final de USDT en Ethereum 1, autorización del minter Base 8453 y wallet owner vigente con pruebas vinculadas al pedido.
- Un proceso de revisión de seguridad que sustituya `INTERNAL_REVIEW_ONLY` por nueva política **sin reutilizar** los callbacks permisivos que sólo existen en tests.
- La entrega/mint posterior y el rescate atómico de NFT siguen deshabilitados; no hay garantías de rendimiento.

## Verificación

En la raíz del repositorio:

```bash
node --test tests/oxGenesisCheckoutV6.test.mjs tests/oxGenesisCommerceIntegrationV6.test.mjs
node --test server/src/tests/oxRareReleaseInventoryTest.mjs
node scripts/inspectGenesisV4.mjs --enforce-assets
```

La instalación V6 también ejecuta las pruebas V1–V5. No se hace `push` ni deploy automáticamente.
