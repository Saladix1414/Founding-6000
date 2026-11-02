export function positionTierPopover(rect: {left: number; top: number; bottom: number}, viewportWidth: number, viewportHeight: number) {
  const width = Math.min(360, Math.max(0, viewportWidth - 24));
  const below = viewportHeight - rect.bottom;
  const above = rect.top;
  const useBelow = below >= 220 || below >= above;
  const space = Math.max(0, (useBelow ? below : above) - 24);
  return {
    width: `${width}px`,
    left: `${Math.max(12, Math.min(rect.left, viewportWidth - width - 12))}px`,
    top: useBelow ? `${Math.max(12, rect.bottom + 8)}px` : 'auto',
    bottom: useBelow ? 'auto' : `${Math.max(12, viewportHeight - rect.top + 8)}px`,
    maxHeight: `${space}px`,
  };
}
