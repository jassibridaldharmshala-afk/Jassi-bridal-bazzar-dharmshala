import { createPortal } from 'react-dom';
import { render } from '@testing-library/react';
import ApplicationTheme from './ApplicationTheme';
import { useWebsiteCustomization } from '../../context/WebsiteCustomizationContext';
import { mergeWebsiteConfig, buildWebsiteCssVariables } from '../../config/websiteCustomization';
import { applyAppearancePreset } from '../../config/websiteDesigner';
import { onColor, brandShades } from '../../config/themeTokens';
jest.mock('../../context/WebsiteCustomizationContext', () => ({ useWebsiteCustomization: jest.fn() }));
jest.mock('@mantine/core', () => ({ MantineProvider: ({ children }) => children, createTheme: jest.fn(value => value) }));
test('published tokens reach document, admin and portals, update live and clean up', () => {
  const root = document.documentElement; root.style.setProperty('--site-primary', '#111111');
  useWebsiteCustomization.mockReturnValue({ config: mergeWebsiteConfig({ colors: { primary: '#123456' } }) });
  const view = render(<ApplicationTheme><div className="admin-shell">Admin</div>{createPortal(<div>Dialog</div>, document.body)}</ApplicationTheme>);
  expect(root.style.getPropertyValue('--site-primary')).toBe('#123456');
  expect(root.style.getPropertyValue('--site-loader')).toBe('#123456');
  expect(root.style.getPropertyValue('--site-primary-rgb')).toBe('18 52 86');
  useWebsiteCustomization.mockReturnValue({ config: mergeWebsiteConfig({ colors: { primary: '#445566' } }) });
  view.rerender(<ApplicationTheme>New theme</ApplicationTheme>);
  expect(root.style.getPropertyValue('--site-primary')).toBe('#445566');
  view.unmount(); expect(root.style.getPropertyValue('--site-primary')).toBe('#111111');
  root.style.removeProperty('--site-primary');
});
test('presets reset shared mobile palette without replacing content or layout overrides', () => {
  const before = mergeWebsiteConfig({ mobile: { enabled: true, inheritThemeColors: false, columns: 1, headerBackground: '#ff0000' } });
  const after = applyAppearancePreset(before, { colors: { primary: '#123456', background: '#ddeeff' }, header: { background: '#ffffff', textColor: '#123456' } });
  expect(after.mobile.inheritThemeColors).toBe(true); expect(after.mobile.columns).toBe(1);
  expect(after.homepage).toEqual(before.homepage); expect(before.mobile.inheritThemeColors).toBe(false);
  expect(buildWebsiteCssVariables(after)['--site-mobile-bg']).toBe('#ddeeff');
  expect(buildWebsiteCssVariables(before)['--site-mobile-header-bg']).toBe('#ff0000');
});
test('light and dark brand colours have readable foregrounds and Mantine palette', () => {
  expect(onColor('#ffffff')).toBe('#17161a'); expect(onColor('#000000')).toBe('#ffffff');
  expect(brandShades('#123456')).toHaveLength(10); expect(brandShades('#123456')[6]).toBe('#123456');
});

test.each(['solid', 'outline', 'soft'])('shared %s button tokens are available to mobile, admin and portals', style => {
  const config = mergeWebsiteConfig({ colors: { primary: '#123456', secondary: '#ddeeff' },
    buttons: { background: '#654321', textColor: '#ffffff', style, borderRadius: 20, hoverEffect: 'glow' } });
  const variables = buildWebsiteCssVariables(config);
  expect(variables['--site-action-bg']).toBe(style === 'outline' ? 'transparent' : style === 'soft' ? '#ddeeff' : '#654321');
  expect(variables['--site-action-text']).toBe(style === 'outline' ? '#654321' : style === 'soft' ? '#123456' : '#ffffff');
  expect(variables['--site-action-border']).toBe(style === 'outline' ? '#654321' : variables['--site-action-bg']);
  useWebsiteCustomization.mockReturnValue({ config });
  const view = render(<ApplicationTheme>Shared buttons</ApplicationTheme>);
  expect(document.documentElement.style.getPropertyValue('--site-button-radius')).toBe('20px');
  expect(document.documentElement.style.getPropertyValue('--site-button-hover-shadow')).toContain('--site-accent');
  expect(require('@mantine/core').createTheme).toHaveBeenLastCalledWith(expect.objectContaining({
    autoContrast: true, luminanceThreshold: .179, defaultRadius: '20px',
  }));
  view.unmount();
});
