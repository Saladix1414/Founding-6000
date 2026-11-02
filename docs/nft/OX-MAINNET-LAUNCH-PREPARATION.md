# Preparación de Base principal y patrocinio

Esta entrega prepara el payload del despliegue y una comprobación de conectividad
CDP. No implementa todavía un ejecutor de emisiones patrocinadas ni abre ventas.
No cambia Worker, inventario, pagos, membresías ni claves de las wallets.

## Uso en Termux

Con las dependencias actuales instaladas (ethers):

```sh
node server/src/tests/oxNftMainnetLaunchPreparationTest.mjs
node blockchain/scripts/prepare-mainnet-launch.mjs --save
```

El plan guardado en `docs/nft/evidence/base-mainnet-launch-plan.json` contiene el
bytecode de creación verificado y los argumentos exactos de Admin, Minter y URI.
Es un payload CREATE directo, no una userOperation ERC-4337 ni un permiso para
enviar transacciones. No debe mandarse directamente al Bundler como userOperation.
La ruta de despliegue patrocinado (cuenta compatible y mecanismo CREATE/factory)
sigue pendiente de seleccionar, validar y probar en Sepolia.

Para comprobar únicamente la conectividad, copiar el endpoint de la red elegida
desde CDP y cargarlo sin mostrarlo ni guardarlo en Git:

```sh
read -r -s -p 'Endpoint privado CDP de Base Sepolia: ' OX_CDP_PAYMASTER_URL
export OX_CDP_PAYMASTER_URL
node blockchain/scripts/prepare-mainnet-launch.mjs --probe-sepolia
unset OX_CDP_PAYMASTER_URL
```

Para Base principal usar su endpoint y `--probe-mainnet`. La prueba permite solo
`eth_chainId` y `eth_supportedEntryPoints`. No pide patrocinio ni envía una operación.
El endpoint y los errores originales del proveedor no aparecen en los informes.
La prueba usa timeout y límite de respuesta, rechaza redirects y URLs no aprobadas.

## Financiación y límites

La solicitud de créditos fue enviada; aprobación y disponibilidad no se asumen.
El límite global de US$1 visible en CDP es un tope, no un saldo gratuito.
El Paymaster puede facturar gas y cargos: confirmar créditos y política antes de uso.
Una respuesta de conectividad no demuestra créditos, smart account compatible,
aprobación de patrocinio, gas gratuito ni soporte para desplegar este contrato.
No se publica un proxy genérico que permita consumir el presupuesto.

## Integración restante

Reutilizar `CommerceCore`, `nft_mint_jobs`, el enlace de wallet y la reserva del lote:

1. Confirmar créditos y límites reales del proveedor.
2. Validar compatibilidad de Admin/Minter con el esquema de cuenta patrocinada.
3. Probar el despliegue patrocinado y verificar runtime, constructor y roles en mainnet.
4. Crear una autorización interna para cada pedido liquidado y serial reservado.
5. Registrar una intención única, pedir patrocinio limitado a la operación autorizada,
   conservar la referencia de envío y reconciliar antes de reintentar.
6. Verificar recibo canónico, evento, serial y receptor, y confirmar entrega
   atómicamente en el pedido. No activar membresía por mera respuesta del Bundler.
7. Validar el ciclo completo, aprobar el lote y coordinar apertura de ventas.

Un timeout después del envío exige reconciliación; no implica fallo de emisión.
No usar la transacción de prueba de #0002 para liquidar un pedido de producción.
Los cobros USDT en Ethereum y el gas de Base son redes distintas: no hay conversión
ni recuperación automática de costes implementada en esta preparación.

## Fuentes consultadas

- https://docs.cdp.coinbase.com/paymaster/introduction/welcome
- https://docs.cdp.coinbase.com/paymaster/faqs
- https://docs.cdp.coinbase.com/paymaster/introduction/quickstart

CDP requiere smart accounts compatibles; no basta con un endpoint en la configuración.
