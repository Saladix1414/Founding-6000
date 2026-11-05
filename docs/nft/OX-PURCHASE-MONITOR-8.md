# Founding 6000 · Monitor privado V8 (solo lectura)

**Estado:** `INTERNAL_ONLY_DISABLED_BY_DEFAULT`. La instalación no ejecuta cambios en la base de Cloudflare ni despliega el Worker. Los pagos reales actuales y las colas Gmail siguen operando sin nuevas puertas ni condiciones.

## Contrato

Se añade `cloudflare/oxPurchaseMonitorV8.mjs` y un único dispatch en el Durable Object `FoundingCore`: `GET /internal/ops/purchase-status-v8`. **NO existe ruta correspondiente en `worker.mjs`**; no se acepta una consulta pública desde el navegador. Para una consulta efectiva, el operador necesitará desarrollar y autorizar un llamador interno con acceso al binding `FOUNDING_CORE` (por ejemplo, un Worker administrativo distinto, protegido por identidad y MFA). Este paquete por sí solo no permite consultar producción por Termux.

La autenticación requiere `OX_PURCHASE_MONITOR_V8_ENABLED=true` y un secreto `OX_PURCHASE_MONITOR_V8_KEY` de longitud 32–256, transmitido como header `x-ox-monitor-key` por enlace interno. Ambos faltan por defecto. Un método, ruta o header incorrectos devuelven 404 sin leer SQLite. Estos controles no sustituyen identidad, auditoría de operador y autorización de acceso del futuro Worker administrativo; no exponer el secreto en URL, frontend o documentación.

## Contenido del informe

- Conteos agregados de órdenes (`CREATED`, `PAID`, `CANCELLED`), intentos USDT y trabajos de mint.
- Totales de liquidaciones verificadas en SQLite, asignaciones de seriales y membresías.
- Cantidad de asignaciones para Genesis #0001.
- Incidencias: orden PAID sin cadena completa de registro; liquidación incongruente con red Ethereum, USDT, importe, destinatario, confirmaciones; asignación que no coincide con venta, membresía o trabajo de mint.
- Sólo indica si existe una tabla de correo reconocida; NO declara correos enviados ni entregabilidad sin reconciliar el esquema real. No se imprimen emails, direcciones, tx hashes, IDs de órdenes ni secretos.

El resultado tiene una huella de informe reproducible, no un asiento legal ni una prueba criptográfica. Son lecturas de filas locales del Durable Object; no contrastan transacciones en Ethereum ni acuñaciones en Base. Un estado `LOCAL_RECORDS_CONSISTENT` indica coherencia relacional, no solvencia ni entrega NFT completada. El monitor no revierte, cancela ni bloquea pagos en caso de inconsistencias; sólo emite información.

## Ejecutar tests

```bash
node --test tests/oxPurchaseMonitorV8.test.mjs
node --test tests/oxLaunchPreflightV7.test.mjs
node --test server/src/tests/purchaseMailTest.mjs
```

## Activación futura (NO incluida)

1. Verificar copia sanitizada de la base real y el estado del desplegado.
2. Configurar secreto independiente en Cloudflare y habilitar el monitor solamente tras configurar control de acceso de operador.
3. Crear un Worker de administración separado, protegido y con autenticación robusta, logs, límites de uso y auditoría.
4. Evaluar evidencia on-chain independiente antes de atribuir dinero recibido o NFT entregados.

**Prohibido:** usar este monitor para autorizar mint, descontar reservas, activar membresías, rescatar o quemar NFT. La política del 50% permanece separada y no reescribe ventas históricas.
