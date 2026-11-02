import assert from 'node:assert/strict';
import {whitepaperSections, WHITEPAPER_BRAND} from '../../../src/whitepaper/whitepaperContent.ts';
import {fullCloseV3, simulateManagedReserveScenario} from '../../../shared/foundingReservePolicyV3.mjs';
assert.equal(WHITEPAPER_BRAND,'OriginX Foundation');
assert.equal(new Set(whitepaperSections.map(section=>section.id)).size,whitepaperSections.length);
for (const section of whitepaperSections) {
  for (const language of ['es','en']) {
    for (const field of ['label','title','summary']) assert.ok(section[field][language]?.trim());
    for (const item of [...(section.paragraphs||[]),...(section.bullets||[]),...(section.cards||[]).map(card=>card.text)]) assert.ok(item[language]?.trim());
  }
}
const reserve=whitepaperSections.find(section=>section.id==='reserves');
const close=fullCloseV3();
const total=close.reduce((sum,row)=>sum+row.reserve,0n);
for(const language of ['es','en']) {
  const locale=language==='es'?'es-AR':'en-US';
  const money=n=>new Intl.NumberFormat(locale,{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n)/1e6);
  assert.ok(reserve.summary[language].includes(money(total)));
  assert.ok(reserve.summary[language].includes(new Intl.NumberFormat(locale).format(Number(total*4n)/1e6)));
  const example=whitepaperSections.find(section=>section.id==='investment').paragraphs[0][language];
  assert.ok(example.includes(money(simulateManagedReserveScenario(total,400,1).netChange)));
}
const esAllocation=reserve.paragraphs[0].es;
for(const row of close) {
  const exact=new Intl.NumberFormat('es-AR',{maximumFractionDigits:4}).format(Number(row.perNft)/1e6);
  assert.ok(esAllocation.includes(exact));
}
console.log('WHITEPAPER_LOCALIZATIONS_AND_CHAPTER_IDS=PASS');
console.log('WHITEPAPER_TOTALS_AND_EXAMPLE_MATCH_RESERVE_V3=PASS');
