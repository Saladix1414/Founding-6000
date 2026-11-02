import { useEffect, useRef } from 'react';
import FoundingMembership from './FoundingMembership';
import { mountMembershipDialog } from './membershipDialogController';
import '../../styles/originx-membership-dialog.css';

export default function FoundingMembershipDialog({language}: {language: 'es' | 'en'}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!dialog.current) return;
    return mountMembershipDialog(dialog.current);
  }, []);
  const es = language === 'es';
  return (
    <dialog ref={dialog} className="ox-membership-dialog" aria-labelledby="ox-membership-title">
      <div className="ox-membership-dialog-bar">
        <span>{es ? 'Beneficios de tu suscripción' : 'Your subscription benefits'}</span>
        <button type="button" autoFocus onClick={() => dialog.current?.close()} aria-label={es ? 'Cerrar beneficios de la suscripción' : 'Close subscription benefits'}>
          {es ? 'Cerrar' : 'Close'} <span aria-hidden="true">×</span>
        </button>
      </div>
      <FoundingMembership language={language} />
    </dialog>
  );
}
