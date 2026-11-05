# Founding 6000 — V9 acceso administrativo separado al monitor V8

**Estado**: `PREPARED_DISABLED_NOT_DEPLOYED`. V9 no altera el checkout, la custodia USDT, Gmail, el Worker original, los registros históricos ni el contrato NFT.

## Diseño

- Un Worker independiente `founding-6000-admin-monitor-v9` con configuración propia `cloudflare/wrangler.admin-v9.jsonc`.
- Binding externo `FOUNDING_CORE` → clase `FoundingCore`, script `founding-6000-prelaunch`, instancia exactamente `canonical-founding-6000`.
- Sólo `GET /v1/purchases/status`, sin querystring, sin cookies ni parámetros de búsqueda; secret Bearer independiente `OX_ADMIN_V9_READ_KEY` de 48–256 caracteres.
- Deshabilitado por defecto `OX_ADMIN_V9_ENABLED=false`, respuestas no-cache y sin detalles ante error.
- Consulta interna al endpoint V8 existente `GET /internal/ops/purchase-status-v8`, que exige separadamente `OX_PURCHASE_MONITOR_V8_ENABLED=true` y `OX_PURCHASE_MONITOR_V8_KEY` (32–256 caracteres).
- Solo resumen de estados y anomalías. Jamás devuelve correos de compradores, tx hashes, billeteras ni IDs individuales. Su resultado **no verifica la cadena Ethereum ni un mint en Base**.

**No desplegar automáticamente:** este paquete NO configura claves reales, NO habilita V8, NO crea una ruta pública en el Worker principal y NO cambia los cuatro flags de pagos habilitados. La consulta V9 no funcionará contra producción hasta que V8 esté realmente desplegado dentro del Worker principal, y que se configuren separadamente claves y autorización en los dos Workers. Subir el código a GitHub por sí solo no activa nada.

## Seguridad antes de un uso real

1. Exigir **Cloudflare Access (SSO + MFA)** para la URL del Worker administrativo y restringir identidad/miembros autorizados. El Bearer V9 es una segunda barrera; por sí solo no constituye MFA ni protección ante credencial filtrada. No incluir ninguna clave en Git, línea de comandos que guarde historial, frontend, documentación, URL, capturas o logs.
2. Rotar claves administrativas cuando corresponda, habilitar rate limiting y auditoría de accesos; evitar poner tokens en procesos que los impriman.
3. Revisar permisos de invocación y el enlace externo DO: el `script_name` debe apuntar exactamente al servicio correcto dentro de la misma cuenta Cloudflare.
4. Validar la salida de V8 con una copia sanitizada, probar aislamiento ante fallas, y confirmar que no existan datos sensibles en las respuestas.
5. El operador debe decidir por separado cuándo habilitar lectura privada; no reutilizar claves de Gmail, wallets, tokens blockchain ni controles de pago.

## Ejecutar pruebas (sin network)

```bash
node --test tests/oxPurchaseAdminV9.test.mjs
node --test tests/oxPurchaseMonitorV8.test.mjs
node --test tests/oxLaunchPreflightV7.test.mjs
node --test server/src/tests/purchaseMailTest.mjs
```

El instalador sólo copia cuatro archivos y hace un commit selectivo. Para un futuro despliegue, usar **exclusivamente** `--config cloudflare/wrangler.admin-v9.jsonc` y una aprobación explícita separada; nunca ejecutar `wrangler deploy` sobre el proyecto base con este paquete. Los cambios no activan ventas Genesis ni rescates.
