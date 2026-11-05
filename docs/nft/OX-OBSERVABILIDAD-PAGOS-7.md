# Founding 6000 — V7: observabilidad de compras y continuidad de pagos

**Estado:** `ADVISORY_ONLY / EXISTING_PAYMENTS_UNTOUCHED`
**Rama:** `deploy/cloudflare-d4`
**Objetivo:** observar la integridad de las compras actuales sin frenar ni modificar el checkout público.

## Lo que no cambia

Los siguientes archivos **no se editan** con esta entrega:

- `wrangler.jsonc` (incluidas las variables `PUBLIC_CHECKOUT_ENABLED`, `PAYMENT_READINESS`, `REAL_PAYMENTS_ENABLED`, `CLOUDFLARE_USDT_API_ENABLED`).
- `cloudflare/worker.mjs` y sus rutas `/api/orders`, `/api/payments/usdt/attempts`, consulta y verificación.
- `cloudflare/foundingCore.mjs` y `cloudflare/commerceCore.mjs` (órdenes, idempotencia, settlement y entregas).
- `cloudflare/rareArcadeRelease.mjs`, wallets receptoras, contratos, claves y configuración RPC.

El script de instalación comprueba el **SHA-256 de estos archivos antes y después**, ejecuta pruebas locales y hace un commit **sólo de cuatro archivos nuevos**. No ejecuta `wrangler deploy` ni `git push`. No altera o desactiva flags ni introduce condiciones adicionales en el procesamiento de pagos.

La configuración Git `wrangler.jsonc` encontrada al elaborar V7 declara los cuatro indicadores de pago como `"true"`. Ese hecho **no equivale a una consulta de la configuración realmente desplegada**. El informe no presupone que Cloudflare tenga datos de cobros ni que se hayan emitido NFT.

## Módulo de inspección de fuentes

`auditLaunchSourceV7(readFile)` examina solo código local, sin llamadas a red. Verifica:

- Que las cuatro banderas sigan configuradas como `true` **en el archivo del repositorio**.
- Que las rutas de pago USDT sigan presentes en el Worker y V6 Genesis siga separado del checkout existente.
- Que el borrador económico muestre el 50% inicial, 15% del neto de servicios posteriores, hasta el 10% invertible y al menos el 90% líquido.
- Que la exclusión heredada del #0001 y otras funciones pendientes aparezcan como asuntos **de integración futura**.
- Que el plan de despliegue del contrato no se presente como si fuera un contrato ya desplegado.

Las marcas `BLOCKED` significan que **una capacidad nueva** no está acreditada y requieren revisión. **Nunca bloquean el checkout existente**. Los resultados no son órdenes, aprobaciones regulatorias ni garantías financieras.

## Módulo de conciliación local de operaciones

`auditLaunchStorageV7(storage)` hace **exclusivamente SELECT** en un objeto de almacenamiento suministrado por un operador confiable o una copia SQLite local. Inspecciona:

- Total de órdenes creadas y pagadas, settlements, asignaciones, membresías, trabajos de mint y NFT Genesis pagados.
- Pedidos `PAID` sin un único settlement/asignación/membresía/trabajo de mint.
- Settlement con intento no verificado, red distinta de Ethereum mainnet, token USDT distinto, receptor o importe discordante, o menos de 12 confirmaciones **según el registro almacenado**.
- Referencia de asignación diferente a la del settlement.
- Desajustes entre número de NFT asignado y los números de membresía / trabajo de mint.
- Consistencia del inventario V5 y el checkout Genesis V6 **sólo si figuran en la copia inspeccionada**.

Una anomalía no es una autorización automática para cancelar, reembolsar, bloquear o volver a intentar operaciones. El informe evita incluir correo, direcciones de billetera, IDs de comprador o hashes de transacciones. Devuelve conteos y códigos de incidencias. **Esto tampoco sustituye verificar independientemente una transacción en Ethereum** ni acredita la emisión/propiedad del NFT en Base.

## Uso en Termux

Desde `~/Founding-6000`:

```bash
node scripts/oxLaunchPreflightV7.mjs
node scripts/oxLaunchPreflightV7.mjs --json
```

Estos comandos no consultan la base de Cloudflare. Sólo inspeccionan fuentes y muestran la situación de integración. Las advertencias tienen **código de salida 0** para que no se conviertan accidentalmente en una puerta de bloqueo de compras.

Si el operador dispone **legítimamente** de una copia de respaldo SQLite de Durable Object en el propio equipo:

```bash
node scripts/oxLaunchPreflightV7.mjs --sqlite "$HOME/respaldo-sanitizado.sqlite" --json
```

La opción `--sqlite` es explícita y solo abre un **archivo regular, no un symlink**, con `readOnly:true` y `PRAGMA query_only=ON`. No exporta datos, no se conecta a Cloudflare ni realiza migraciones. El informe puede incluir conteos privados: no lo publiques sin revisión. **No compartas copias reales con emails o datos financieros.** No hay opción `--strict` ni mecanismos de apagado.

## Trabajo siguiente

1. Añadir **acceso de operador autenticado y auditado** para consultar estos conteos en un Durable Object en producción (sin poner IDs/personas en la respuesta ni exponer endpoints de escritura).
2. Confirmar mediante un proveedor independiente si hay pagos reales y sus receipts con finality en Ethereum. Esto requiere una autorización/control de configuración aparte.
3. Probar notificaciones de venta nueva y problemas de entrega usando el canal de correo configurado, con deduplicación y sin exponer secretos, sin interferir con el procesador de pagos.
4. Seguir revisando por separado la apertura de venta del NFT #0001 y el mint en Base. La disponibilidad de cobros no demuestra entrega NFT.
5. Aprobar legal y operativamente la política V4 del 50%, tratar el histórico de 25% sin reescritura, y conciliar custodia antes de cualquier movimiento de reservas.

**Nunca bloquear los pagos activos en esta fase.**
