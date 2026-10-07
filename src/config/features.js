function enabledByDefault(value) {
  return !['false', '0', 'no', 'off'].includes(String(value ?? 'true').trim().toLowerCase());
}

export const reelProductImportEnabled = enabledByDefault(process.env.REACT_APP_ENABLE_REEL_PRODUCT_IMPORT);
