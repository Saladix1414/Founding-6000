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

Durante ventas: 100% de los aportes líquidos, 0% invertido, sin retiros operativos de ese capital. Solo después del cierre verificado y de habilitar el mecanismo de rescate: objetivo 80% líquido y un máximo inicial del 20% invertido. Sobre 114.987,50 USDT, son 91.990 USDT líquidos y hasta 22.997,50 USDT invertidos. Es una distribución propuesta; la custodia actual no se presenta como bloqueo técnico demostrado.

No se permite endeudamiento, apalancamiento, derivados, estrategias de trading, tokens especulativos ni puentes dentro de la estrategia propuesta. Hasta 10% del patrimonio por protocolo: el 20% requeriría al menos dos exposiciones aprobadas; si solo se aprueba una, se invierte como máximo 10% y el resto sigue líquido. No se fuerza la inversión para alcanzar un porcentaje.

Candidatos a evaluar: suministro sin deuda de stablecoins en protocolos auditados y con mercado compatible con la cadena de rescate. Aave es un candidato de estudio, no una selección ni una tasa comprometida. Mantener USDC no paga por sí mismo al titular el rendimiento de las reservas del emisor; Circle Reserve Fund tampoco se presume accesible a OriginX. Ningún producto o proveedor está habilitado por este cambio.

No hay garantía de que una stablecoin mantenga paridad o de que un protocolo permita retirar inmediatamente. Una auditoría reduce incertidumbre técnica, no elimina fallos. Una pérdida de paridad también puede afectar el 80% líquido: no se limita artificialmente el riesgo total a la parte invertida.

### Condiciones previas y control

1. Verificar cierre, entregas y saldo disponible; separar dinero operativo y reservas por categoría.
2. Aprobar instrumento, cadena, contratos, riesgo del emisor, auditorías, liquidez de salida, comisiones, fiscalidad y custodia. No inferir compatibilidad Ethereum USDT / NFT en Base; la liquidación y quema atómicas requieren una ruta de fondos en la misma cadena.
3. Custodia propuesta con firmantes separados y autorización múltiple; no implementada por este documento. Presupuesto de gas y costes fuera de las reservas de titulares salvo política publicada distinta.
4. Probar aportes/retiros en testnet y retirada pequeña; empezar con hasta 5% total, revisar 30 días y escalar solo hasta los límites aprobados.
5. Revisión diaria de saldo, paridad, liquidez y cambios del protocolo; conciliación mensual y antes de cada rebalanceo. Alertas propuestas: paridad fuera de 0,995–1,005 USD, incidente del protocolo o retiro fallido: detener nuevas inversiones y evaluar salida. Son umbrales operativos propuestos, no una garantía de salida o precio.
6. El simulador rebalancea anualmente. En operación, revisar concentraciones mensualmente y reducir excedentes con autorización; nunca usar el rebalanceo para aumentar el riesgo tras una pérdida sin revisión.
7. Para rescates, verificar liquidez efectiva y presupuesto antes de ofrecer importe ejecutable; el objetivo 80% no garantiza liquidez para el 100% de titulares simultáneamente. Si no hay fondos suficientes, la operación no quema el NFT. No prometer retiros instantáneos de posiciones ilíquidas.

## 4. Estimados reproducibles

Las tasas son supuestos, no tasas actuales ni pronósticos de Aave u otro proveedor. Se expresan netas de costes de la estrategia sobre el 20% invertido, no sobre el fondo entero. La porción líquida supone rendimiento cero y paridad constante. Sin ventas nuevas, rescates intermedios, variaciones de precio del token líquido ni impuestos personales. La estrategia deberá documentar sus costes reales antes de sustituir supuestos por rendimiento observado.

Cada año: separar 80% líquido y 20% invertido, aplicar la tasa supuesta a la parte invertida y reunir ambas partes. El siguiente año se rebalancea de nuevo. El cálculo descarta solo fracciones inferiores a una unidad mínima de USDT; no inventa saldo.

| Escenario ilustrativo a 1 año | Tasa neta del 20% invertido | Resultado del fondo | Capital final | RARE/unidad | EPIC/unidad | LEGENDARY/unidad |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Sin rendimiento | 0% | 0 | 114.987,50 | 40 | 22,49375 | 10 |
| Sensibilidad positiva | 4% | +919,90 | 115.907,40 | 40,32 | 22,67370 | 10,08 |
| Sensibilidad positiva mayor | 8% | +1.839,80 | 116.827,30 | 40,64 | 22,85365 | 10,16 |
| Estrés | -20% | -4.599,50 | 110.388,00 | 38,40 | 21,59400 | 9,60 |

Un 4% sobre el 20% invertido representa 0,8% sobre el fondo el primer año, no 4%. Cada categoría participa proporcionalmente de su propia subreserva; no se trasladan resultados entre categorías sin una nueva regla. La ganancia del comprador respecto a su compra es otra magnitud y no se oculta ni se suma dos veces al importe de rescate.

## 5. Evidencia y publicación posterior

En la siguiente etapa, mostrar por separado: ventas liquidadas, aportes contables, reservas depositadas verificadas, capital invertido, liquidez disponible, rendimiento realizado, rendimiento no realizado, costes y fecha de actualización. Vincular a referencias de transacciones públicas sin datos personales. Una venta contable no demuestra por sí sola depósito, inversión o retorno. El panel pendiente no debe mezclar simulaciones con saldo observado.

Fuentes consultadas el 2 de noviembre de 2026:

- Aave, riesgos técnicos, liquidez, red y puentes: https://www.aave.com/docs/resources/risks
- Aave, rendimientos variables y retiros condicionados por liquidez: https://www.aave.com/faq
- Investor.gov, diversificación y riesgo: https://www.investor.gov/introduction-investing/getting-started/asset-allocation
- Circle, transparencia de las reservas del emisor: https://www.circle.com/transparency

La asignación 80/20 y sus límites son una propuesta propia de OriginX; las fuentes no la recomiendan ni avalan los escenarios numéricos.
