# Rescate después del cierre: preparación

La intención del producto es permitir el rescate desde la web mediante pago y quema del NFT. No se implementa un ejecutor ni se habilita el rescate con este cambio. `economicExitPolicy.ts`, la política NAV, el contrato, Worker, pagos y bases de datos permanecen sin cambios. El README no se modifica.

## Cierre y capital durante las ventas

La colección contiene 6.000 números. El plan actual reserva #0001 Azhurak: el cierre comercial previsto cubre 5.999 ventas únicas de #0002 a #6000 y el número reservado. No se cuenta la reserva como venta ni como aporte de 50 USDT. La preparación comprueba cobertura exacta suministrada, pero no autentica los cobros ni certifica el cierre.

Se registra como requisito mantener íntegros los aportes de reserva antes de habilitar la quema: no retiros ni rescates de ese capital durante las ventas. Esto es una política prevista, no prueba de custodia bloqueada ni protección ya impuesta por el contrato. El 25% de aporte y sus repartos existentes no cambian.

## Simulación por comprador

El ejemplo utiliza el cierre completo, el suministro máximo por categoría como divisor ilustrativo y los controles existentes de inversión. No reutiliza este divisor como política de rescate efectiva ni altera HISTORICAL_ISSUED_SUPPLY.

| Categoría | Compra de referencia | Importe del modelo al cierre sin inversión | Diferencia antes de costes |
| --- | ---: | ---: | ---: |
| RARE | 50 USDT | 57,2375 USDT | +7,2375 USDT |
| EPIC | 70 USDT | 18,75 USDT | -51,25 USDT |
| LEGENDARY | 90 USDT | 6,75 USDT | -83,25 USDT |

No hay ganancia general demostrada por el reparto actual. Un rescate inferior al precio pagado representa pérdida para el comprador. Las inversiones pueden tener resultados negativos. Las comisiones e impuestos del comprador no están definidos y no se inventan. La diferencia mostrada no es beneficio neto después de costes. El modelo de inversión supone que las subreservas evolucionan a la misma tasa elegida, sin retiradas ni rescates durante ese plazo; no es una estrategia ya ejecutada ni incluye flujos intermedios.

## Pendiente antes de habilitar el cobro

- Autenticar cada venta liquidada y entrega. #0001 necesita una decisión explícita sobre elegibilidad, emisión y participación; no se cambia silenciosamente el divisor económico.
- Aprobar fórmula de importe, reparto de resultados, tratamiento de pérdidas, suministro tras quemas, comisiones, liquidez, límites y momento de habilitación.
- Verificar las reservas reales, moneda, cadena y custodia. El cobro existente de USDT en Ethereum y el NFT previsto en Base no permiten inferir un pago y quema atómicos entre ambas cadenas. Debe diseñarse y probarse una ruta de liquidez en la misma cadena para la operación atómica.
- Implementar contrato/ruta verificable: propiedad actual, autorización, protección de reentrancia, plazos, precio mínimo aceptado, bloqueo de doble cobro y concurrencia. La quema y el pago deben completar juntos o revertirse juntos. Nunca quemar primero esperando un pago posterior.
- Registrar identificador único, débito de reserva, estado del NFT, evidencia canónica y reconciliación sin duplicados. Pruebas de fondos insuficientes y fallo del token deben demostrar que el titular conserva su NFT si no recibe pago.
- Activar una nueva política versionada únicamente tras verificar el ejecutor y los fondos; completar ventas por sí solo no autoriza transacciones en esta preparación.

`preparePostSaleRedemption` siempre devuelve las autorizaciones de pago, quema y débito en falso, incluso con cobertura completa. No es una función de autenticación ni una condición de apertura para producción. El panel de movimientos reales por venta se desarrollará en la siguiente etapa.
