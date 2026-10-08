import { useEffect, useRef } from 'react';
const dialogs = [];
let previousOverflow;
const selector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
function controls(element) {
  return Array.from(element.querySelectorAll(selector)).filter(node => !node.closest('[hidden], [inert], [aria-hidden="true"]') && node.tabIndex >= 0 && getComputedStyle(node).visibility !== 'hidden' && getComputedStyle(node).display !== 'none');
}
export default function useModalFocus(open, onClose) {
  const ref = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open || !ref.current) return undefined;
    const dialog = { element: ref.current, trigger: document.activeElement };
    if (!dialogs.length) { previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
    dialogs.push(dialog);
    const focus = () => (controls(dialog.element)[0] || dialog.element).focus();
    focus();
    const top = () => dialogs[dialogs.length - 1] === dialog;
    const keydown = event => {
      if (!top()) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close.current?.(); return; }
      if (event.key !== 'Tab') return;
      const items = controls(dialog.element), active = document.activeElement;
      if (!items.length) { event.preventDefault(); dialog.element.focus(); return; }
      if (!dialog.element.contains(active) || (event.shiftKey ? active === items[0] : active === items[items.length - 1])) {
        event.preventDefault(); (event.shiftKey ? items[items.length - 1] : items[0]).focus();
      }
    };
    const focusin = event => { if (top() && !dialog.element.contains(event.target)) focus(); };
    document.addEventListener('keydown', keydown, true);
    document.addEventListener('focusin', focusin);
    return () => {
      const wasTop = top();
      document.removeEventListener('keydown', keydown, true); document.removeEventListener('focusin', focusin);
      dialogs.splice(dialogs.indexOf(dialog), 1);
      if (!dialogs.length) document.body.style.overflow = previousOverflow;
      if (wasTop) {
        const remaining = dialogs[dialogs.length - 1];
        if (dialog.trigger?.isConnected && (!remaining || remaining.element.contains(dialog.trigger))) dialog.trigger.focus();
        else if (remaining) (controls(remaining.element)[0] || remaining.element).focus();
      }
    };
  }, [open]);
  return ref;
}

