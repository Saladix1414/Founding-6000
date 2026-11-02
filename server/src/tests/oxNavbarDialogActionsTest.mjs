import assert from 'node:assert/strict';
import {activateNavbarDialog} from '../../../src/components/landing/navbarDialogActions.ts';
for (const section of ['membership','project','economy']) {
  const actions=[];
  const doc={dispatchEvent:event=>actions.push(event.type)};
  activateNavbarDialog(section,()=>actions.push('close'),()=>actions.push('focus'),()=>actions.push('economy-callback'),doc);
  assert.deepEqual(actions,['close','focus',section==='economy'?'economy-callback':'ox:open-'+section]);
}
console.log('NAV_CLOSES_AND_RESTORES_VISIBLE_TRIGGER_BEFORE_OPEN=PASS');
console.log('MEMBERSHIP_PROJECT_AND_ECONOMY_USE_DIALOG_ACTIONS=PASS');
