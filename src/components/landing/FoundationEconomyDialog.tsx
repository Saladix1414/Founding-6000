import { useEffect, useRef } from 'react';
import FoundationEconomy from './FoundationEconomy';
import { mountMembershipDialog } from './membershipDialogController';
import '../../styles/originx-membership-dialog.css';
import '../../styles/originx-economy-dialog.css';

export default function FoundationEconomyDialog({language}: {language: 'es' | 'en'}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!dialog.current) return;
    return mountMembershipDialog(dialog.current, document, {rootId: 'economia', eventName: 'ox:open-economy', openOnInitialHash: false});
  }, []);
  const es = language === 'es';
  return (
    <dialog ref={dialog} className="ox-membership-dialog ox-economy-dialog" aria-labelledby="ox-economy-dialog-title">
      <div className="ox-membership-dialog-bar">
        <span id="ox-economy-dialog-title">{es ? 'Economía de Founding 6000' : 'Founding 6000 economics'}</span>
        <button type="button" autoFocus onClick={() => dialog.current?.close()} aria-label={es ? 'Cerrar economía' : 'Close economics'}>
          {es ? 'Cerrar' : 'Close'} <span aria-hidden="true">×</span>
        </button>
      </div>
      <FoundationEconomy language={language} />
    </dialog>
  );
}
