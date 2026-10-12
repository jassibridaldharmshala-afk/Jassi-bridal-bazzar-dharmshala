import { useLayoutEffect, useMemo } from 'react';
import { MantineProvider, createTheme } from '@mantine/core';
import { useWebsiteCustomization } from '../../context/WebsiteCustomizationContext';
import { buildWebsiteCssVariables } from '../../config/websiteCustomization';
import { brandShades } from '../../config/themeTokens';

// The document owns the published tokens so portals, dialogs, loaders, admin
// and customer screens all inherit the same theme. Preview iframes own theirs.
export default function ApplicationTheme({ children }) {
  const { config } = useWebsiteCustomization();
  const variables = useMemo(() => buildWebsiteCssVariables(config), [config]);
  const theme = useMemo(() => createTheme({
    primaryColor: 'brand', primaryShade: 6, autoContrast: true, luminanceThreshold: .179,
    defaultRadius: variables['--site-button-radius'],
    fontFamily: variables['--site-body-font'],
    headings: { fontFamily: variables['--site-heading-font'], fontWeight: String(variables['--site-heading-weight']) },
    colors: { brand: brandShades(config.colors.primary), maroon: brandShades(config.colors.primary) },
    components: {
      Button: { styles: (_theme, props) => ({ root: {
        fontFamily: 'var(--site-button-font)', fontWeight: 'var(--site-button-weight)',
        ...((!props.variant || props.variant === 'filled') && (!props.color || ['brand', 'maroon'].includes(props.color)) ? {
          backgroundColor: 'var(--site-action-bg)', color: 'var(--site-action-text)', borderColor: 'var(--site-action-border)',
        } : {}),
      } }) },
    },
  }), [config.colors.primary, variables]);
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previous = new Map(Object.keys(variables).map(key => [key, root.style.getPropertyValue(key)]));
    const marker = root.getAttribute('data-app-theme');
    root.setAttribute('data-app-theme', 'true');
    Object.entries(variables).forEach(([key, value]) => value === undefined ? root.style.removeProperty(key) : root.style.setProperty(key, String(value)));
    return () => {
      previous.forEach((value, key) => value ? root.style.setProperty(key, value) : root.style.removeProperty(key));
      if (marker === null) root.removeAttribute('data-app-theme'); else root.setAttribute('data-app-theme', marker);
    };
  }, [variables]);
  return <MantineProvider theme={theme} forceColorScheme={variables['--site-color-scheme']} cssVariablesResolver={resolveThemeVariables}>{children}</MantineProvider>;
}

// Mantine's floating dropdowns and portals inherit the same published surfaces
// as CSS components, including after a light/dark switch while they are open.
function resolveThemeVariables() {
  const surfaces = {
    '--mantine-color-body': 'var(--site-background)',
    '--mantine-color-text': 'var(--site-text)',
    '--mantine-color-dimmed': 'var(--site-muted)',
    '--mantine-color-placeholder': 'var(--site-muted)',
    '--mantine-color-default': 'var(--site-surface)',
    '--mantine-color-default-hover': 'var(--site-tint)',
    '--mantine-color-default-color': 'var(--site-text)',
    '--mantine-color-default-border': 'var(--site-border)',
    '--mantine-color-disabled': 'var(--site-surface-alt)',
    '--mantine-color-disabled-color': 'var(--site-muted)',
    '--mantine-color-error': 'var(--site-danger)',
  };
  return { variables: surfaces, light: surfaces, dark: surfaces };
}
