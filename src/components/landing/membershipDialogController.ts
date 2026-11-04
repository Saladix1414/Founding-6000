const activeContentDialogs = new Map<HTMLDialogElement, () => void>();

export function mountMembershipDialog(dialog: HTMLDialogElement, doc: Document = document, options: {rootId?: string; eventName?: string; openOnInitialHash?: boolean} = {}) {
  const rootId = options.rootId ?? 'benefits';
  let trigger: HTMLElement | null = null;
  let previousOverflow: string | null = null;
  const restore = () => {
    if (previousOverflow !== null) doc.body.style.overflow = previousOverflow;
    previousOverflow = null;
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    trigger = null;
  };
  const open = (source: HTMLElement | null) => {
    if (dialog.open) return;
    for (const [other, dismiss] of activeContentDialogs) if (other !== dialog && other.open) dismiss();
    trigger = source;
    dialog.showModal();
    previousOverflow = doc.body.style.overflow;
    doc.body.style.overflow = 'hidden';
  };
  const onClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const target = event.target as Element | null;
    const link = target?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!link) return;
    const href = link.getAttribute('href');
    const destination = href?.startsWith('#') ? doc.getElementById(href.slice(1)) : null;
    const targetsDialog = href === '#' + rootId || (rootId !== 'benefits' && destination && dialog.contains(destination));
    if (targetsDialog && !dialog.open) {
      event.preventDefault();
      open(link);
      if (destination && href !== "#" + rootId) destination.scrollIntoView({block: "start"});
    } else if (dialog.open && dialog.contains(link) && href?.startsWith('#')) {
      const destination = doc.getElementById(href.slice(1));
      if (destination && !dialog.contains(destination)) {
        trigger = null;
        dialog.close();
        restore();
      }
    }
  };
  const dismiss = () => { trigger = null; if (dialog.open) dialog.close(); restore(); };
  const onCommand = () => open(doc.activeElement as HTMLElement | null);
  activeContentDialogs.set(dialog, dismiss);
  if (options.eventName) doc.addEventListener(options.eventName, onCommand);
  doc.addEventListener('click', onClick);
  dialog.addEventListener('close', restore);
  const initialId = options.openOnInitialHash === false ? '' : doc.location.hash.slice(1);
  const initialTarget = initialId ? doc.getElementById(initialId) : null;
  if (initialId === rootId || (rootId !== 'benefits' && initialTarget && dialog.contains(initialTarget))) {
    open(null);
    if (initialTarget && initialId !== rootId) initialTarget.scrollIntoView({block: 'start'});
  }
  return () => {
    activeContentDialogs.delete(dialog);
    if (options.eventName) doc.removeEventListener(options.eventName, onCommand);
    doc.removeEventListener('click', onClick);
    dialog.removeEventListener('close', restore);
    if (dialog.open) dialog.close();
    restore();
  };
}
