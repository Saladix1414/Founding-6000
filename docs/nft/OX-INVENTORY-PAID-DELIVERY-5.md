# OriginX Founding 6000 — V5 Inventario versionado y entrega pagada de Genesis

**Estado:** `CODE_PREPARED`, `STAGING_MIGRATION_NOT_RUN_IN_PRODUCTION`, `NO_COMMERCE_OR_MINT_ACTIVATION`.
**Rama auditada:** `deploy/cloudflare-d4`, posterior al commit V4 `a059843`.
**Entrega:** módulos nuevos de uso exclusivamente interno, pruebas SQLite y documentación. **Sin cambios a `CommerceCore`, `FoundingCore`, `worker.mjs`, la política de pagos, contratos, metadatos o inventario de producción.**

## Por qué la migración es aditiva

La tabla vigente `nft_release_assets` tiene un `CHECK(serial_number BETWEEN 2 AND 1000)` persistido en SQLite. Modificar solamente el JavaScript no cambia ese CHECK ni autoriza la venta del token #0001. En vez de reconstruir la tabla live —con riesgo sobre compras existentes— V5 crea un esquema paralelo con nuevos nombres; la preparación se hace en **una sola transacción**.

`cloudflare/oxInventoryCutoverV5.mjs`:

- `previewInventoryCutoverV5({ storage })`: lectura previa. Obtiene un hash SHA-256 de las filas históricas en orden por serial; exige coherencia entre estados de preparación/reserva/asignación y órdenes e `inventory_allocations`.
- `initializeInventoryCutoverV5(storage)`: crea únicamente las tablas `ox_release_assets_v5` y `ox_inventory_cutovers_v5`, y triggers de inmutabilidad.
- `stageInventoryCutoverV5({ storage, genesisCertificate, authorizeStaging })`: **opt-in interno**, no existe ruta HTTP que lo invoque. Exige candidato V4 registrado con certificado coincidente, autorización explícita, ausencia de asignación previa de #0001 y snapshot histórico coherente. Copia las filas históricas sin alterarlas y agrega exactamente una fila `GENESIS_V4 / #0001 / PREPARED`. Graba `STAGED_NOT_ACTIVE`.

Los estados del inventario importado son una **fotografía histórica**, no sustituyen a las tablas que utiliza `CommerceCore`. Tras staging, cualquier cambio en el inventario heredado requiere otra migración/reconciliación versionada. Repetir la operación con el mismo snapshot es idempotente; un cambio de snapshot provoca bloqueo. Las escrituras se hacen dentro de `transactionSync`, por lo que una falla de inserción revierte también el registro #0001. En DO SQLite debe comprobarse la compatibilidad de la API SQL y realizar snapshot/backups operacionales antes de ejecutar staging con datos reales.

## Registro separado de intención de entrega pagada

`cloudflare/oxPaidGenesisDeliveryV5.mjs` crea `ox_paid_genesis_delivery_intents_v5` con una intención **solo preparatoria** para `tokenId=1`. No cambia la restricción 2..1000 de `nft_paid_delivery_intents` anterior, que conserva todas las intenciones existentes. La versión nueva exige:

1. Un `nft_mint_job` de #0001 `READY`, sin transacción mint enviada; membresía `ACTIVATION_PENDING` y orden `PAID`.
2. Un vínculo único con asignación histórica, settlement de USDT Ethereum (`chainId=1`), transacción e intento verificado; 12 confirmaciones, token y receptor permitidos, importe de 50 USDT (6 decimales), valor idéntico al precio de compra.
3. Inventario V5 Genesis, manifiesto de corte y certificado V4 consistente; no admite un archivo arbitrario ni un token diferente de #0001.
4. Wallet Base (8453) vinculada, desafío ECDSA previamente verificado, grant consumido, evento de binding y evento de `MINT_JOB_READY` coincidentes.
5. **Autorización del contexto interno** y una **reverificación externa confiable del settlement**. Se rechaza la operación si cualquiera de las funciones no existe o devuelve `false`.

Una vez satisfecha esta evidencia, registra una fila inmutable, con hash del payload e idempotencia. Devuelve `PREPARED_NOT_AUTHORIZED`, `mintAuthority:false`, `transactionSubmitted:false`, `mintCalldataPrepared:false`, `membershipActivated:false`.

**Importante:** `preparePaidGenesisDeliveryV5` no tiene ruta pública ni está conectado al flujo de cobro. El `CommerceCore` actual todavía no asigna #0001, por lo que hoy no existe el prerequisito de negocio para emitir una intención real. Los callbacks permissivos `()=>true` en tests se usan **únicamente** en SQLite de memoria, con datos falsos. En producción, no deben reemplazar pruebas de blockchain, identidad y política aprobadas. El paquete no incluye un validador operacional remoto ni permisos para los contratos.

## Política económica y respaldo

Esta entrega mantiene la dirección del negocio: **los 6.000 NFT comercializables, ninguno reservado**. No aplica automáticamente el 50% a ventas históricas del 25%; no mueve reservas, no habilita inversiones, no paga rescates ni quema NFT. La política V4 sigue en borrador. La mera existencia de un certificado no equivale a un pago confirmado, NFT emitido, activo líquido o derecho financiero habilitado.

Las tablas V5 son *append-only* con triggers; no se ofrece mecanismo destructivo de rollback en una base de producción. En desarrollo, un fallo de staging antes del commit SQLite revierte completamente. Para una instalación real se exige backup comprobable y una política de compensación/migración, no un `DROP TABLE` sobre datos que pudieran haberse usado.

## Validación

```bash
node --test tests/oxInventoryCutoverV5.test.mjs tests/oxPaidGenesisDeliveryV5.test.mjs
node --test tests/oxInventoryCutoverV5.test.mjs tests/oxPaidGenesisDeliveryV5.test.mjs tests/oxGenesisV4.test.mjs tests/oxEconomicCutoverAudit.test.mjs tests/oxEconomicPolicySources.test.mjs tests/oxOnchainObservations.test.mjs tests/oxProductRegistries.test.mjs
node scripts/inspectGenesisV4.mjs --enforce-assets
```

Suite en entorno de ensayo: **56 tests PASS** (41 de V1–V4 y 15 de V5). No se consultó una cadena real ni se ejecutó una migración de la base de producción. Los tests SQL en Node se realizan con `node:sqlite` de memoria, no sustituyen una prueba integral del Durable Object desplegado.

## Bloqueos para V6 / puesta en servicio

1. Desarrollar y auditar una ruta de checkout versionada para #0001 que utilice inventario V5, sin reinterpretar órdenes previas; aprobar su lanzamiento por separado.
2. Adaptar selección de lotes y `nftPaidDeliveryIntent` de la etapa legacy, y verificar que no se duplique la intención entre tablas.
3. Implementar callback de settlement con verificador real y confianza de proveedor RPC; fijar contratos y roles de Base con ejecución verificable.
4. Ejecutar simulación integrada sobre una copia sanitizada de la DB Durable Object, con transacciones en curso, reintentos y recuperación.
5. Reconciliar reservas reales, antiguo porcentaje, movimientos históricos y política efectiva con fecha/hash aprobados.
6. Auditar el contrato y la ejecución atómica de cobro+quema en Base; rescate sigue **deshabilitado**.

No hay `push`, `wrangler deploy`, cambios de secretos ni habilitación de cobro/mint en la instalación del paquete.
