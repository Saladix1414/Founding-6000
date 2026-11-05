# OriginX Founding 6000 — V4 Genesis #0001 + cobertura 6000

**Estado:** `GENESIS_ASSET_VERIFICATION_AND_FULL_SUPPLY_PREPARATION` / `NO_COMMERCE_CUTOVER`.

Se trata de un hito **preparatorio**, sin rutas nuevas, sin modificación de tablas o inventario de producción, sin despliegue, sin claves, sin activación de pagos, de mint o de rescates. No altera el JSON, imagen, glifo, ADN ni los registros akáshicos existentes del token #0001.

## 1. Certificado local del NFT #0001

`cloudflare/oxGenesisReleaseV4.mjs` compara bytes reales del repositorio:

- `public/nft/metadata/1.json`
- `public/nft/rare/0001/image-<mediaHash>.png`
- `public/nft/rare/0001/glyph-<glyphHash>.svg`

Comprueba hashes SHA-256 de **archivo**, cabecera PNG 2048×2048, nombre Azhurak, serial #0001, tier RARE, identidad OriginX, flags de autoridad inactivos y URLs canónicas. Devuelve una huella reproducible del certificado. Una coincidencia positiva demuestra consistencia de archivos, **no** prueba de despliegue on-chain ni elegibilidad comercial. Si los bytes reales no coinciden, el instalador se detiene sin hacer commit.

`assessGenesisMintSource` verifica que el código fuente del plan y del contrato contemplen el token 1; no verifica bytecode desplegado, roles del minter ni eventos on-chain.

### Registro lateral de candidato verificado

`cloudflare/oxGenesisInventoryV4.mjs` incorpora una tabla separada, `ox_genesis_asset_candidates_v4`, que sólo acepta el serial 1, guarda hashes del certificado y los activos y establece el estado inmutable `PREPARED_NOT_FOR_SALE`. Su escritor interno valida el certificado y es idempotente. **No pertenece al inventario comercial activo, no se integra con `CommerceCore`, no reserva un NFT para un pedido ni crea derecho a mintear**. El módulo queda sin conectar a Worker y no crea tablas a menos que un futuro operador lo invoque expresamente.

## 2. Cierre exacto 6000 / cero reservados

`cloudflare/oxFullSupplyCoverageV4.mjs` establece la definición de cobertura **de la nueva versión**: deben figurar los seriales #0001..#6000 exactamente una vez; no hay NFT reservados. La distribución es 1000 RARE, 2000 EPIC y 3000 LEGENDARY. Rechaza seriales duplicados, faltantes, inválidos o reservados. La cobertura se basa sólo en un arreglo provisto por el llamador y **no autentica ninguna venta**. Aunque exista cobertura completa, retorna todos los permisos de pago, quema, inversión y rescate en `false`.

## 3. Barreras reales de integración (no subsanadas en esta entrega)

La rama auditada incluye versiones anteriores que excluyen #0001:

- `rareReleaseInventory.mjs`: `nft_release_assets` fue creada con un CHECK 2..1000 y la tanda actual es `rare-0002-0101`. Es **incorrecto cambiar sólo un CHECK en el código**: el SQLite ya persistido conservaría la restricción antigua. Hace falta migración de tabla versionada con reconciliación de asignaciones/ventas y prueba de rollback.
- `nftPaidDeliveryIntent.mjs`: la tabla de intents también tiene CHECK 2..1000, y la ruta `rare-0002-0101` está fijada. Se requiere ruta V2 para el token #0001 con asset verificado, settlement, wallet, mint job e idempotencia. Nunca generar un intent sin pago verificado.
- `nftPostSaleRedemptionPreparation.mjs`: la versión histórica asume 5999 vendidos y #0001 reservado. La nueva V4 deja de usar esa premisa, pero no reescribe el módulo histórico ni su evidencia.

`rareArcadeRelease.approvedForSale` permanece `false` y el módulo V4 no está conectado al Worker. La política de reservas al 50% sigue siendo un borrador; no se reemplaza retroactivamente el 25% ni se autocontabiliza ningún cobro. Mantener trazabilidad exacta de la versión de política por settlement antes de cualquier corte operativo.

## 4. Auditoría

Desde la raíz del repositorio:

```bash
node --test tests/oxGenesisV4.test.mjs
node scripts/inspectGenesisV4.mjs
node scripts/inspectGenesisV4.mjs --json
node scripts/inspectGenesisV4.mjs --enforce-assets
```

`--enforce-assets` falla ante arte faltante/inconsistente o código fuente que no admite #0001; no intenta desbloquear los tres módulos legacy. El informe de consola muestra explícitamente `BLOCKED` donde corresponda, aunque los hashes del NFT #0001 sean correctos.

## 5. Hito siguiente

1. Inventariar tablas existentes y verificar que no haya órdenes para el serial #0001 en ninguna base.
2. Construir migración versionada del inventario #0001, manteniendo intactas la tanda 0002..0101 y ventas previas; exigir aprobación explícita por lote.
3. Preparar entrega pagada V2 sin excepciones de pago o wallet para #0001; prueba de idempotencia, reversión, replay y fail-closed.
4. Reconciliar políticas contables históricas y fijar fecha/hash de corte. Verificar desplegado ERC-721 Base y finanzas/liquidez por cadena.
5. Sólo tras pruebas, auditoría y autorización independiente evaluar apertura de una nueva tanda.

La presencia de metadata o imagen no garantiza titularidad, derechos financieros o ganancias.
