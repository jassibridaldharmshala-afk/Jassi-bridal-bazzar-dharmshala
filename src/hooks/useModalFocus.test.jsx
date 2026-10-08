import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import useModalFocus from './useModalFocus';
function Dialog({ name, close }) {
  const ref = useModalFocus(true, close);
  return <div role="dialog" aria-label={name} tabIndex={-1} ref={ref}><button disabled>Disabled</button><button>{name} first</button><button>{name} last</button></div>;
}
test('focus wraps in both directions, Escape uses the latest callback and closing restores trigger and scroll', () => {
  const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus(); document.body.style.overflow = 'auto';
  const first = jest.fn(), latest = jest.fn(); const view = render(<Dialog name="One" close={first} />);
  expect(screen.getByRole('button', { name: 'One first' })).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true }); expect(screen.getByRole('button', { name: 'One last' })).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Tab' }); expect(screen.getByRole('button', { name: 'One first' })).toHaveFocus();
  view.rerender(<Dialog name="One" close={latest} />); fireEvent.keyDown(document, { key: 'Escape' }); expect(latest).toHaveBeenCalledTimes(1); expect(first).not.toHaveBeenCalled();
  view.unmount(); expect(trigger).toHaveFocus(); expect(document.body.style.overflow).toBe('auto'); trigger.remove(); document.body.style.overflow = '';
});
test('only the top stacked dialog handles Escape and scroll remains locked until the last closes', () => {
  const outer = jest.fn();
  function Stack() { const [inner, setInner] = useState(false); return <><Dialog name="Outer" close={outer} /><button onClick={() => setInner(true)}>Open inner</button>{inner && <Dialog name="Inner" close={() => setInner(false)} />}</>; }
  const view = render(<Stack />); fireEvent.click(screen.getByRole('button', { name: 'Open inner' }));
  fireEvent.keyDown(document, { key: 'Escape' }); expect(screen.queryByRole('dialog', { name: 'Inner' })).not.toBeInTheDocument(); expect(outer).not.toHaveBeenCalled(); expect(document.body.style.overflow).toBe('hidden');
  fireEvent.keyDown(document, { key: 'Escape' }); expect(outer).toHaveBeenCalledTimes(1); view.unmount(); expect(document.body.style.overflow).toBe('');
});
