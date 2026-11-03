import assert from 'node:assert/strict';
import {whitepaperSections, WHITEPAPER_BRAND} from '../../../src/whitepaper/whitepaperContent.ts';
import {simulateBatchClose, simulateManagedReserveScenario} from '../../../src/components/landing/economySimulation.ts';
assert.equal(WHITEPAPER_BRAND,'OriginX Foundation');
assert.equal(new Set(whitepaperSections.map(section=>section.id)).size,whitepaperSections.length);
for (const section of whitepaperSections) {
  for (const language of ['es','en']) {
    for (const field of ['label','title','summary']) assert.ok(section[field][language]?.trim());
    for (const item of [...(section.paragraphs||[]),...(section.bullets||[]),...(section.cards||[]).map(card=>card.text)]) assert.ok(item[language]?.trim());
  }
}
const reserve=whitepaperSections.find(section=>section.id==='reserves');
const close = simulateBatchClose();
for (const language of ['es', 'en']) {
  const format = new Intl.NumberFormat(language === 'es' ? 'es-AR' : 'en-US');
  const money = minor => format.format(Number(minor) / 1e6) + ' USDT';
  assert.ok(reserve.summary[language].includes(money(close.reserve)));
  assert.ok(reserve.summary[language].includes(money(close.sales)));
  assert.ok(reserve.paragraphs[0][language].includes(money(close.minting)));
  assert.ok(reserve.paragraphs[0][language].includes(money(close.forWebsite)));
  const example = whitepaperSections.find(section => section.id === 'investment').paragraphs[0][language];
  assert.ok(example.includes(money(simulateManagedReserveScenario(close.reserve, 400, 1).netChange)));
  for (const stage of close.stages) {
    const card = reserve.cards.find(card => card.title === stage.tier);
    assert.ok(card.text[language].includes(money(stage.contribution)));
  }
}
console.log('WHITEPAPER_LOCALIZATIONS_AND_CHAPTER_IDS=PASS');
console.log('WHITEPAPER_TOTALS_AND_EXAMPLE_MATCH_50_PERCENT_MODEL=PASS');
