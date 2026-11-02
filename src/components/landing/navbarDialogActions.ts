export function activateNavbarDialog(
  section: 'membership' | 'economy' | 'project',
  closeMenu: () => void,
  focusTrigger: () => void,
  openEconomy: () => void,
  doc: Document = document,
) {
  closeMenu();
  focusTrigger();
  if (section === 'economy') openEconomy();
  else doc.dispatchEvent(new Event('ox:open-' + section));
}
