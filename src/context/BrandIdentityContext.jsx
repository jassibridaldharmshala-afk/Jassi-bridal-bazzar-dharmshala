import { createContext, useContext } from 'react';
import { DEFAULT_WEBSITE_CONFIG } from '../config/websiteCustomization';

export const BrandIdentityContext = createContext({
  ...DEFAULT_WEBSITE_CONFIG.branding,
  announcementEnabled: DEFAULT_WEBSITE_CONFIG.header.announcementEnabled,
  announcementText: DEFAULT_WEBSITE_CONFIG.header.announcementText,
  managed: false,
});
export function useBrandIdentity() { return useContext(BrandIdentityContext); }
