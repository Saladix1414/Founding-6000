export function mountMembershipDialog(dialog: HTMLDialogElement, doc: Document = document) {
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
    if (href === '#benefits' && !dialog.open) {
      event.preventDefault();
      open(link);
    } else if (dialog.open && dialog.contains(link) && href?.startsWith('#')) {
      const destination = doc.getElementById(href.slice(1));
      if (destination && !dialog.contains(destination)) {
        trigger = null;
        dialog.close();
      }
    }
  };
  doc.addEventListener('click', onClick);
  dialog.addEventListener('close', restore);
  if (doc.location.hash === '#benefits') open(null);
  return () => {
    doc.removeEventListener('click', onClick);
    dialog.removeEventListener('close', restore);
    if (dialog.open) dialog.close();
    restore();
  };
}
