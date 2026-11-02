# Intención de entrega ligada al pedido liquidado

## Alcance

`nftPaidDeliveryIntent.mjs` añade una preparación interna persistente con una
intención única por pedido, trabajo de emisión, membresía y serial. Reutiliza
CommerceCore y `buildNftMintExecutionPlan`; no crea pedidos o cobros paralelos.

No está montada en HTTP ni invocada automáticamente desde el Worker.
No solicita patrocinio, firma, envía operaciones, confirma entregas ni activa
membresías. Es la etapa de vinculación persistente previa al futuro ejecutor.
La comprobación anterior de CDP solo confirmó conectividad.

## Uso interno previsto

Inicializar `initializePaidDeliveryIntentSchema(storage)` en una migración
controlada. Invocar `preparePaidDeliveryIntent` desde una frontera interna
autenticada, con la misma instancia de almacenamiento canónico de CommerceCore.
La función abre su propia transacción: no llamarla dentro de otra transacción.

`authorizePreparation` es un callback de integración de confianza; no constituye
por sí mismo autenticación. Debe regresar exactamente `true` de forma síncrona.
Nunca construirlo con un booleano o rol recibido del navegador. Las pruebas
usan un callback fixture, que no debe copiarse a una ruta pública.

## Evidencia requerida

- Trabajo READY, wallet vinculada en Base, auditoría de preparación existente.
- Pedido PAID, intento VERIFIED y liquidación persistida de USDT en Ethereum.
- Correspondencia de hash de pago, importe, token, receptor, red y asignación.
- Al menos 12 confirmaciones persistidas por el verificador de pagos existente.
- Lote `rare-0002-0101`, serial asignado 2–101, recurso ALLOCATED para ese pedido.
- Wallet challenge verificado, claim consumido y evento de vinculación.
- Membresía pendiente con fechas de activación vacías.

La autenticidad del pago depende de la frontera de liquidación existente. Esta
función no vuelve a consultar Ethereum ni autentica independientemente el RPC.
La integridad de archivos se verificó en la preparación del lote: aquí se liga
su referencia persistida. No se vuelven a descargar las imágenes o metadatos.

## Persistencia y reintentos

Tabla `nft_paid_delivery_intents`, estado PREPARED. El hash determinista liga
pedido, liquidación, NFT, wallet, calldata y perfil de artefacto esperado.
Las restricciones UNIQUE serializan preparaciones concurrentes del mismo activo.
La misma solicitud con contexto idéntico devuelve la intención existente.
Si el contexto o el contenido guardado cambian, la preparación se bloquea.
La función exige READY también en el reintento; una emisión en curso necesita
la futura reconciliación del ejecutor, no una nueva intención.

`contractAddress` permanece null hasta contar con un despliegue mainnet
verificado. La intención no se puede enviar directamente como una userOperation.
No admite migrar a un receptor distinto ni reusar la emisión testnet de #0002.

## Validación

```sh
node server/src/tests/oxNftPaidDeliveryIntentTest.mjs
node server/src/tests/oxRareReleaseInventoryTest.mjs
node server/src/tests/oxNftMintReadinessTransitionTest.mjs
node server/src/tests/oxNftMintExecutionPlanTest.mjs
```

La prueba crea 100 compras fixture en SQLite en memoria, recorre la liquidación
canónica con evidencia simulada e inserta pruebas de wallet exclusivamente fixture.
Usa la transición existente de readiness antes de preparar las intenciones.
Prueba idempotencia, unicidad, rollback, alteraciones de contexto y ausencia
de mutaciones comerciales. No hay pagos, red, gas o emisiones reales.

## Pendientes para una emisión patrocinada real

Confirmar financiación y cuenta compatible; elegir y probar el despliegue
patrocinado; verificar contrato mainnet; montar frontera interna autenticada;
ligar contrato a la intención; implementar solicitud limitada de patrocinio,
firma autorizada, envío único, reconciliación y confirmación atómica de entrega.
Completar después la aprobación del lote y la prueba del ciclo antes de apertura.
