import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mountMembershipDialog} from '../../../src/components/landing/membershipDialogController.ts';

function fixture(hash='') {
  const handlers=new Map(), dialogHandlers=new Map();
  const outside={inside:false};
  let shown=0,closed=0,focused=0;
  const doc={body:{style:{overflow:'auto'}},location:{hash},
    addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:name=>handlers.delete(name),
    getElementById:id=>id==='ox-business-reserve-scenario'?outside:{inside:true}};
  const dialog={open:false,showModal(){this.open=true;shown++;},close(){this.open=false;closed++;dialogHandlers.get('close')?.();},
    contains:node=>node.inside===true,
    addEventListener:(name,fn)=>dialogHandlers.set(name,fn),removeEventListener:name=>dialogHandlers.delete(name)};
  const cleanup=mountMembershipDialog(dialog,doc);
  const click=(href,{modified=false,inside=false}={})=>{
    let prevented=false;
    const link={inside,isConnected:true,getAttribute:()=>href,focus(){focused++;}};
    const event={defaultPrevented:false,button:0,ctrlKey:modified,metaKey:false,shiftKey:false,altKey:false,
      target:{closest:()=>link},preventDefault(){prevented=true;}};
    handlers.get('click')?.(event);
    return prevented;
  };
  return {doc,dialog,cleanup,click,handlers,dialogHandlers,counts:()=>({shown,closed,focused})};
}
const f=fixture();
assert.equal(f.dialog.open,false);
assert.equal(f.click('#economia'),false);
assert.equal(f.click('#benefits',{modified:true}),false);
assert.equal(f.counts().shown,0);
assert.equal(f.click('#benefits'),true);
assert.equal(f.dialog.open,true);
assert.equal(f.doc.body.style.overflow,'hidden');
f.dialog.close();
assert.equal(f.doc.body.style.overflow,'auto');
assert.equal(f.counts().focused,1);
f.click('#benefits');
assert.equal(f.click('#ox-membership-lifecycle',{inside:true}),false);
assert.equal(f.dialog.open,true);
f.click('#ox-business-reserve-scenario',{inside:true});
assert.equal(f.dialog.open,false);
assert.equal(f.doc.body.style.overflow,'auto');
f.click('#benefits');f.cleanup();
assert.equal(f.dialog.open,false);
assert.equal(f.doc.body.style.overflow,'auto');
assert.equal(f.handlers.size,0);assert.equal(f.dialogHandlers.size,0);
const direct=fixture('#benefits');assert.equal(direct.dialog.open,true);direct.cleanup();
const app=readFileSync(new URL('../../../src/App.tsx',import.meta.url),'utf8');
const modal=readFileSync(new URL('../../../src/components/landing/FoundingMembershipDialog.tsx',import.meta.url),'utf8');
assert.doesNotMatch(app,/<FoundingMembership\s/);
assert.equal((app.match(/<FoundingMembershipDialog\s/g)||[]).length,1);
assert.equal((modal.match(/<FoundingMembership\s/g)||[]).length,1);
assert.match(modal,/<dialog/);assert.match(modal,/aria-labelledby="ox-membership-title"/);
assert.match(modal,/autoFocus/);
console.log('BENEFITS_OPEN_IN_MODAL_WITHOUT_PAGE_SCROLL=PASS');
console.log('CLOSE_RESTORES_SCROLL_AND_TRIGGER_FOCUS=PASS');
console.log('INTERNAL_AND_EXTERNAL_LINKS_AND_DEEP_LINK=PASS');
console.log('LISTENERS_CLEANED_UP=PASS');
console.log('ONE_CANONICAL_MEMBERSHIP_INSIDE_DIALOG_ONLY=PASS');
