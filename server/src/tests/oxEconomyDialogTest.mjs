import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mountMembershipDialog} from '../../../src/components/landing/membershipDialogController.ts';
const listeners = new Map();
const doc = {body:{style:{overflow:'auto'}},location:{hash:''},activeElement:null,
  addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);},
  removeEventListener(name,fn){listeners.get(name)?.delete(fn);},
  getElementById(id){return id==='benefits'?benefitsNode:id==='economia'?economyNode:id==='ox-business-reserve-scenario'?businessNode:null;}};
let scrolled=0,focused=0;
const benefitsNode={group:'benefits'},economyNode={group:'economia'},businessNode={group:'economia',scrollIntoView(){scrolled++;}};
function modal(group){const events=new Map();return {open:false,contains:n=>n?.group===group,
  showModal(){this.open=true;},close(){this.open=false;events.get('close')?.();},
  addEventListener:(n,f)=>events.set(n,f),removeEventListener:n=>events.delete(n)};}
const economy=modal('economia'),benefits=modal('benefits');
const cleanupEconomy=mountMembershipDialog(economy,doc,{rootId:'economia',eventName:'ox:open-economy'});
const cleanupBenefits=mountMembershipDialog(benefits,doc);
function dispatch(name,event){for(const fn of [...(listeners.get(name)||[])])fn(event);}
const trigger={isConnected:true,focus(){focused++;}};
doc.activeElement=trigger;
dispatch('ox:open-economy');assert.equal(economy.open,true);assert.equal(doc.body.style.overflow,'hidden');
function click(href,group){const link={...trigger,group,getAttribute:()=>href};const e={defaultPrevented:false,button:0,target:{closest:()=>link},preventDefault(){this.defaultPrevented=true;}};dispatch('click',e);return e.defaultPrevented;}
assert.equal(click('#benefits','economia'),true);
assert.equal(economy.open,false);assert.equal(benefits.open,true);assert.equal(doc.body.style.overflow,'hidden');
assert.equal(click('#ox-business-reserve-scenario','benefits'),true);
assert.equal(benefits.open,false);assert.equal(economy.open,true);assert.equal(scrolled,1);assert.equal(doc.body.style.overflow,'hidden');
economy.close();assert.equal(doc.body.style.overflow,'auto');assert.equal(focused,1);
cleanupEconomy();cleanupBenefits();assert.equal([...listeners.values()].every(set=>set.size===0),true);
const app=readFileSync(new URL('../../../src/App.tsx',import.meta.url),'utf8');
assert.doesNotMatch(app,/<FoundationEconomy\s/);
assert.equal((app.match(/<FoundationEconomyDialog\s/g)||[]).length,1);
const wrapper=readFileSync(new URL('../../../src/components/landing/FoundationEconomyDialog.tsx',import.meta.url),'utf8');
assert.equal((wrapper.match(/<FoundationEconomy\s/g)||[]).length,1);
console.log('ECONOMY_BUTTON_OPENS_MODAL=PASS');
console.log('ECONOMY_REMOVED_FROM_LANDING_FLOW=PASS');
console.log('BENEFITS_AND_ECONOMY_SWITCH_WITH_SCROLL_LOCK=PASS');
console.log('BUSINESS_ANCHOR_AND_FOCUS_RESTORATION=PASS');
