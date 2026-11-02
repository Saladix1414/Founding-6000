# Reparto V2 y plan de inversión de reservas

Estado: reglas de cálculo V2 preparadas y usadas en el simulador. No hay inversión real autorizada, proveedor aprobado ni rescate habilitado. Este documento reemplaza los importes ilustrativos del reparto V1 en la preparación anterior, sin reescribir asientos históricos ni el README.

## 1. Objetivos y supuestos del cierre

6.000 números: #0001 Azhurak reservado, 999 ventas RARE a 50 USDT, 2.000 EPIC a 70 y 3.000 LEGENDARY a 90. Venta prevista total: 459.950 USDT. Aporte de reserva fijo del 25%: 114.987,50 USDT. El 75% restante no constituye beneficio neto ni financia un rescate adicional implícito.

Los cálculos por unidad siguen usando el suministro máximo 1.000 / 2.000 / 3.000 como divisor ilustrativo. La emisión, elegibilidad de Azhurak y el divisor efectivo de rescate aún deben resolverse por política versionada. La cifra de 40 USDT no es un mínimo garantizado, ni se suma al precio de compra al quemar.

| Venta individual | Aporte del 25% | A RARE | A EPIC | A LEGENDARY |
| --- | ---: | ---: | ---: | ---: |
| RARE 50 USDT | 12,50 | 12,50 | 0 | 0 |
| EPIC 70 USDT | 17,50 | 8,75 | 8,75 | 0 |
| LEGENDARY 90 USDT | 22,50 | 3,3375 | 9,1625 | 10 |

Las proporciones son RARE 1/1, EPIC 1/2 y 1/2, LEGENDARY 801/5400, 2199/5400 y 2400/5400. Estos últimos porcentajes son periódicos: no se redondean a puntos básicos para registrar dinero. Se calcula en enteros de 6 decimales USDT y se rechazan importes sin reparto exacto. Los porcentajes de pantalla son aproximados; mandan las fracciones y los importes.

| Cierre de tanda | Subreserva RARE acumulada | EPIC acumulada | LEGENDARY acumulada |
| --- | ---: | ---: | ---: |
| RARE | 12.487,50 | 0 | 0 |
| EPIC | 29.987,50 | 17.500,00 | 0 |
| LEGENDARY | 40.000,00 | 44.987,50 | 30.000,00 |

Importes por unidad al cierre sin inversiones: RARE 40; EPIC 22,49375; LEGENDARY 10 USDT. Redondear EPIC a 22,49 para pantalla no cambia el cálculo interno. Estos son importes según reserva, no beneficio respecto de los precios de 50 / 70 / 90 USDT.

## 2. Compatibilidad y activación contable

`shared/foundingReservePolicyV2.mjs` es la fuente única de los nuevos importes, utilizada por el simulador y exportada expresamente desde la política del servidor. La función histórica `calculateReserveContribution` permanece en V1 para no reinterpretar liquidaciones anteriores. El escritor existente `reserveService.ts` y el Worker no pasan automáticamente a V2 con esta entrega.

Antes de contabilizar una venta real con V2: identificar el escritor canónico activo, conciliar ventas/depósitos V1, fijar un corte y conservar la versión en cada asiento, incorporar numerador y denominador racionales al esquema correspondiente y verificar replays/concurrencia. No guardar las fracciones como `weight_bps` enteros ni aplicar V2 retroactivamente. Si ya existen aportes V1, el total final por categoría diferirá del ejemplo y deberá recalcularse o ajustarse mediante asientos explícitos autorizados. Los objetivos indicados suponen todas las ventas bajo V2.

## 3. Plan de inversión propuesto

Prioridad: liquidez de rescate, conservación del capital y trazabilidad; rendimiento secundario. El plan no equivale a un fondo regulado constituido ni demuestra resultados futuros.

Durante las ventas: 100% líquido y 0% invertido. Después del cierre y la habilitación del rescate: objetivo 90% líquido y máximo 10% invertido. Sobre 114.987,50 USDT: 103.488,75 líquidos y hasta 11.498,75 invertidos. Es una propuesta, sin proveedor aprobado ni ejecución autorizada.

Sin deuda, apalancamiento ni puentes. El 4% neto anual es un supuesto sobre el 10% invertido: +459,95 USDT al fondo en un año, equivalente al 0,4% de la reserva inicial. RARE +0,16; EPIC +0,089975; LEGENDARY +0,04 USDT por unidad. Se conservan escenarios negativos; sin garantía de capital ni retiros inmediatos. La liquidez y los costes reales deben verificarse antes de activar una estrategia. No se modifica el libro histórico ni la política de salida deshabilitada.
