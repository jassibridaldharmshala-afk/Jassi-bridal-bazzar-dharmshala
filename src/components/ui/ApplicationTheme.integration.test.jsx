import { StrictMode } from 'react';
import { createPortal } from 'react-dom';
import { render, screen } from '@testing-library/react';
import { Button, useMantineTheme } from '@mantine/core';
import ApplicationTheme from './ApplicationTheme';
import { useWebsiteCustomization } from '../../context/WebsiteCustomizationContext';
import { mergeWebsiteConfig } from '../../config/websiteCustomization';

jest.mock('../../context/WebsiteCustomizationContext', () => ({ useWebsiteCustomization: jest.fn() }));

function PortalButton() {
  const theme = useMantineTheme();
  return createPortal(<Button data-testid="themed-dialog-action"
    data-brand={theme.colors.brand[6]} data-radius={theme.defaultRadius}
    data-contrast={String(theme.autoContrast)}>Dialog action</Button>, document.body);
}

test('real Mantine controls and portals use the published theme through strict-mode updates', () => {
  useWebsiteCustomization.mockReturnValue({ config: mergeWebsiteConfig({ colors: { primary: '#ffffff' }, buttons: { borderRadius: 20 } }) });
  const view = render(<StrictMode><ApplicationTheme><PortalButton /></ApplicationTheme></StrictMode>);
  const button = screen.getByTestId('themed-dialog-action');
  expect(button.dataset.brand).toBe('#ffffff');
  expect(button.dataset.radius).toBe('20px');
  expect(button.dataset.contrast).toBe('true');
  expect(button.style.getPropertyValue('--button-color')).toBe('var(--mantine-color-black)');
  useWebsiteCustomization.mockReturnValue({ config: mergeWebsiteConfig({ colors: { primary: '#123456' }, buttons: { borderRadius: 4 } }) });
  view.rerender(<StrictMode><ApplicationTheme><PortalButton /></ApplicationTheme></StrictMode>);
  expect(screen.getByTestId('themed-dialog-action').dataset.brand).toBe('#123456');
  expect(screen.getByTestId('themed-dialog-action').dataset.radius).toBe('4px');
  expect(screen.getByTestId('themed-dialog-action').style.getPropertyValue('--button-color')).toBe('var(--mantine-color-white)');
  expect(document.documentElement.style.getPropertyValue('--site-loader')).toBe('#123456');
  view.unmount();
  expect(document.documentElement.hasAttribute('data-app-theme')).toBe(false);
});
