# Admin Storefront navigation fix

8 October 2026. Changed `src/components/admin/AdminHeader.jsx` only.

The desktop Storefront button waited for `POST /auth/switch-mode` before navigation. A failed or unavailable request left the administrator on the same page. The public storefront now opens through a normal internal link. Signed-in admin state is preserved, and the storefront's existing Admin action returns to the dashboard. The mobile header also has a labelled store icon. Known boutique context is included in the destination; custom-host stores keep their canonical `/` home.

## Verification

- Existing admin access/session regressions: 2 suites / 16 tests passed on Node 20.20.2. Logs: `.tmp/storefront-return-tests.log`.
- Strict production build passed; no temporary QA API override. Log: `.tmp/storefront-return-production-build.log`.
- Strict lint passed for the changed header. Log: `.tmp/storefront-return-lint.log`.
- Actual production bundle tested in headless Chrome at 390px and 1440px, for default-store and host-boutique contexts. All four cases opened the storefront and returned to admin, preserved the authenticated admin, made zero mode-switch requests, and had no page exceptions or horizontal overflow.
- Mode-switch fixture was configured to return 503 if requested. API responses were isolated local fixtures; no real provider or authenticated production call was made. Dashboard data was outside the fixture, so its screenshot shows an expected unavailable-data message; this was not counted as live dashboard acceptance.

Evidence: [browser results](storefront-return-qa.json), [phone header](storefront-return-admin-390.png), [desktop header](storefront-return-admin-1440.png).

Source/build updated locally. Not deployed. Backend authorization, mode switching and licence enforcement were unchanged. Earlier complete-project verification remains historical; the counts above are the current affected checks and are not added to earlier totals.
