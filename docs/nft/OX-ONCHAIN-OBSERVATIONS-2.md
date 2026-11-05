# OX-ONCHAIN-OBSERVATIONS-2 — verificaciones externas, solo lectura

**Estado:** `READ_ONLY_ADAPTER_PREPARED`, **no conectado a producción**.
**Objetivo:** rama `deploy/cloudflare-d4` de Founding 6000.
**Alcance:** `cloudflare/oxOnchainObservations.mjs` y `tests/oxOnchainObservations.test.mjs`. No modifica rutas Worker, `FoundingCore`, contratos, metadata, checkout ni autorizaciones de registros.

## 1. Titularidad del NFT en Base

`observeBaseNftOwner({ rpc, contractAddress, expectedRuntimeSha256, serialNumber, minimumConfirmations })`

1. Comprueba `eth_chainId=8453`.
2. Obtiene el bloque etiquetado `finalized` y exige al menos 12 confirmaciones observadas.
3. Fija `eth_getCode` y `eth_call ownerOf(uint256)` al **mismo block hash** con EIP-1898 (`requireCanonical:true`).
4. Compara el hash SHA-256 del bytecode de ejecución con el hash *aprobado* que proporciona el operador. No se permite un contrato arbitrario suministrado por el navegador.
5. Recomprueba bloque y red al concluir y devuelve propietario **en ese bloque finalizado**, nunca una autorización de acceso.

**Requisitos faltantes:** contrato desplegado y verificado, hash de bytecode de runtime aprobado, RPC controlado por servidor, prueba de posesión de wallet y reconciliación de transferencia más reciente. Un `ownerOf` histórico no confirma el propietario actual en la punta de la cadena. No sustituye los verificadores sincrónicos `authorize` / `verifyEvidence` de `oxMembershipRegistry`. Ningún usuario puede activar membresías con la mera salida de esta consulta.

## 2. Observación de fondos de reserva Ethereum

`observeEthereumUsdtVault({ rpc, vaultAddress, expectedTokenRuntimeSha256, minimumConfirmations })`

Consulta exclusivamente Ethereum mainnet, en `0xdAC17F958D2ee523a2206206994597C13D831ec7` (USDT) mediante `balanceOf(address)` en bloque finalizado, con bytecode fijado por hash y EIP-1898. Devuelve saldo bruto en unidades mínimas como **string entero** (6 decimales en la política de USDT). No hace `approve`, `transfer`, `sendTransaction`, ni compara activos entre redes.

`compareEthereumReserveJournal({ observation, journal })` compara el saldo leído con `journal.liquidEthereumMinor` y expresa el excedente o faltante en unidades mínimas sin usar coma flotante. **No certifica la propiedad de la wallet**, otras obligaciones sobre su saldo, solvencia total, fuente del dinero ni la liquidez necesaria en Base. Tampoco realiza asientos contables.

Importante: el USDT de Ethereum **no** es liquidez atómica para rescatar NFT en Base. No se presume cuál será el activo/token de liquidación en Base: requiere una política aprobada y un contrato ejecutor auditado.

## 3. Confianza, egress y seguridad

- Únicamente se permiten métodos `eth_chainId`, `eth_blockNumber`, `eth_getBlockByNumber`, `eth_getCode` y `eth_call`.
- `rpc.send` se inyecta desde contexto confiable del servidor. Este módulo **no valida URLs** ni implementa protección SSRF, límites de timeout o tamaño de respuesta. No debe conectarse directamente a un parámetro o URL proporcionado por el cliente. Para producción se requiere un transporte HTTP con URL fija/allowlist, timeout, límite de respuesta, JSON-RPC ID binding, autenticación del proveedor si aplica y monitorización.
- El hash de runtime debe ser configurado y aprobado por operador; no se acepta por defecto.
- La fuente RPC *no* es una verificación de consenso independiente. Todas las respuestas indican `rpcSourceIndependentlyVerified:false` y capacidades de gasto/rescate deshabilitadas.
- No importarlo en rutas públicas ni pasar los resultados como `verifyEvidence:()=>true` en los registros. Diseñar una futura atestación firmada por servidor, un contexto de autorización independiente y comprobaciones contra RPC actual/finality antes de activar entitlement.
- La consulta en `finalized` fallará si el proveedor no soporta ese bloque o llamadas fijadas con hash; **no hay fallback a `latest`**.

## 4. Puertas antes de producción

1. Resolver la discrepancia histórica **25% y serial #0001 reservado** frente al modelo comercial más reciente **50% y ningún NFT reservado**. Sin reinterpretar asientos anteriores.
2. Confirmar contrato ERC-721 desplegado en Base, runtime hash permitido y titularidad operacional del contrato.
3. Configurar RPC de solo lectura seguro del lado del servidor y probar con respuestas reales, doble proveedor/reorg y validación de block hash.
4. Probar lectura del USDT real del vault; inventariar y conciliar los movimientos existentes sin declarar el balance disponible si no coincide la custodia.
5. Crear política versionada y aprobada de destino de fondos, inversión por voto, elegibilidad, denominadores de rescate y disclosures legales.
6. Construir/verificar ejecutor atómico en **la misma cadena** que entrega pago y quema; ninguna solicitud preparatoria puede ejecutar la quema.

## 5. Pruebas

`node --test tests/oxOnchainObservations.test.mjs`

Todas son pruebas simuladas con transporte RPC falso. No ejecutan tráfico a blockchain ni constituyen auditoría de producción.
