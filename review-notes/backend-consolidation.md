# Backend folder consolidation

8 October 2026. The user confirmed Render uses `backend/` and requested deletion of the duplicate `backend-deploy/` folder.

- Both paths were real directories inside `C:\Project\jassi-general-store`; the removed tree contained no filesystem links.
- Production source/configuration matched after Windows line-ending normalization. There was no deployment-only source file.
- The only source difference was the CORS unit test. Existing backend tests now also assert `x-store-slug` support and rejection of unrelated Render origins, retaining both folders' checks.
- All 174 upload files found only in the removed folder were copied to `backend/uploads/` and SHA256 verified before deletion.
- `backend/.env`, `.env.example`, installed dependencies and its own Git repository were retained.
- `backend-deploy/`, including its duplicate dependencies and clone metadata, was removed. The root working tree records deletion of its pre-existing Git link; no commit or push was performed.
- README and local QA helpers now use `backend/`. The root Render blueprint already specified `rootDir: backend`, and the root server script already uses `backend/server.js`.

## Checks

Node 20.20.2 checked `backend/server.js` and `backend/app.js` syntax. Both retained CORS tests passed from `backend/`; see `.tmp/backend-consolidation-tests.log`. These checks are separate from earlier full-suite counts.

Earlier audit references to `backend-deploy/` are historical. Corresponding source files now live in `backend/`. No hosted service, production database, credentials or Render settings were changed.
