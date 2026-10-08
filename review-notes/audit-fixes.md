# Jassi store audit fixes

Reviewed on 8 October 2026. Source: the supplied Jassi-Store-Audit.pdf, the user's pasted 198-row tracker and the attached 119-point findings.

The PDF's descriptions, historical test totals and next-phase proposals were treated as audit evidence. The user's request authorized implementing the source fixes. No production migration, deployment, secret validation, SMS send, charge or refund was performed.

## Verification

| Check | Result |
| --- | --- |
| Runtime used | Node 20.20.2 |
| Applicable frontend | 141 suites, 1,032 tests passed; no React act warnings |
| Complete backend run | 917 tests passed; 0 failed/cancelled/skipped |
| Final affected backend follow-up | 10 privacy/migration/grouping/readiness API tests passed; these overlap the full run |
| Final affected frontend follow-up | 5 rental-browser tests passed; overlapping the full frontend run |
| Production build | Strict CI build passed, source maps disabled, temporary QA API absent |
| Backend syntax | server.js and app.js checked |
| Runtime backend mirror | 92 task paths copied and SHA256 matched |
| Browser QA | Guest combined quote/scoped sign-in, date-only reload, exact linked dates and authenticated draft recovery passed at 390px and 1440px |
| Live read-only check | Health HTTP 200; exact frontend-origin CORS preflight HTTP 204 |

The platform-owned ClientInstallations test remains present but is explicitly excluded because its implementation and lifecycle APIs are absent from this generated client. Important tenant tests now use already-provisioned test stores/memberships and execute the authentic client guards.

The final backend migration follow-up occurred after the full run, checking exact record cohorts, legacy order-to-store backfill, two stores sharing an uploader/URL, unresolved ownership refusal and replay. Scoped counts are not added to the full-run totals.

See [verification-summary.json](verification-summary.json), [all 198 tracker rows](audit-closure.csv), [all 119 attached findings](rental-findings-119.md), [current phone QA](rental-recovery-phone.png) and [current desktop QA](rental-recovery-desktop.png). Browser screenshots use a labelled isolated fixture, not production inventory or real provider payments.

## Implemented source changes

### Customer rental journey

- Public rental browsing and quoting work with user=null. The automatic global sign-in popup no longer covers public browsing.
- Exact offer links are verified before selection; removed offers and failed collections give corrections and retry.
- Seeded dates and restored plans open the availability/item step automatically.
- Product cards, quick view, wishlist and custom home cards enter rental planning directly. Sale actions stay separate.
- Dates → items → verified contact → review is progressively revealed. Guest contacts appear after OTP sign-in; the final review shows separate rent, refundable security, advance, due-now amount and pickup balance.
- My rentals has mobile account access, readable lifecycle/request labels, error recovery and a contact/payment fallback.
- Account routes, bags, pending payments and OTP return navigation retain explicit boutique scope. Expiring public plans retain item IDs, quantities, dates and occasion time, including date-only plans before any item is selected.
- Signed-in contact/address/fitting/delivery details recover within a 24-hour account-and-boutique-scoped tab draft. Explicit logout, account deletion and successful reservation clear private contact drafts. Guests/counter customer contacts are not persisted. Quotes, prices and terms acceptance are never restored, and private details remain outside URLs.
- Only the active desktop/mobile product layout mounts. Rental FAQs use owner settings and appear on booking, contact and related policy pages.
- Consent-aware rental funnel events include the server-verified payment result.

### Merchant and Smart Fill

- Sidebar task groups, direct mobile Rentals access and dashboard shortcuts make daily rental work discoverable.
- Photo drafts show upload → Smart Fill → merchant review → publish → guided rental setup.
- A reviewed per-item grid edits mode, sale price/stock, daily rent and security. Existing advance/fitting settings, draft revisions and partial-save errors are preserved.
- A bounded setup queue identifies missing price, offer, components or pieces. Temporary cleaning is treated separately from permanently missing inventory.
- Single and batch Smart Fill leave financial suggestions unselected until merchant review. Actual physical quantities, rental prices, deposits and fitting measurements are not inferred from photos.
- Optional photo grouping uses bounded AI copies and requires merchant approval. Every original is retained; grouping does not create or publish products by itself.
- Existing batch pacing, owner lock, cancellation, quota handling and protected merchant edits remain.

### Sale correctness, privacy and deployment

- Successful COD/prepaid checkout refreshes the backend bag instead of deleting full purchased line IDs a second time.
- Public products, cart, wishlist, quotes, customer order/history/receipt and return responses strip merchant-only cost, supplier, inventory-location and audit fields. Staff accounting data remains.
- New sale checkout enforces resolved-store closures; existing successful/pending order recovery remains available after closure.
- Missing/invalid production OTP mode selects real production delivery. Both deployment blueprints use production OTP defaults and explicit actual deployment/provider/licence placeholders.
- Public catalogue reads are bounded; requested limits are honored, customer listings paginate and staff/export workflows remain complete. The product-link audit now paginates and refuses an incomplete/changed-catalogue claim.
- Universal 5–7-day delivery promises are replaced by a quoted estimate or shop-confirmation wording.
- Shared dialog focus handles Tab/Shift+Tab, current Escape callbacks, stacked scroll locks and trigger restoration.
- Installation identity/credentials remain backend-only. Production licence checks remain enforced.

### Images and private evidence

- Catalogue masters retain native resolution/detail with lossless optimization and actual MIME; no mandatory 100 KB cap or browser lossy master encoding.
- Master URLs remain available for zoom; separate lossless display derivatives and srcset/sizes reduce card/gallery transfers.
- Public sources allow 20 MB each; streaming multipart staging enforces 60 MB total and cleans rejected/interrupted uploads.
- Image bytes are decoded, animation/SVG/corruption and oversized rasters are rejected, identifying metadata is removed, and orientation/ICC handling is covered by pixel/MIME tests.
- Smart Fill, grouping and background analysis use separate bounded copies. Product masters are not overwritten by AI or preview generation.
- New packing and return evidence uses private GridFS and authorized, non-cached retrieval. Customer evidence is owned; staff access checks current membership and permissions. Private budgets are visible: photos 8 MB, videos 50 MB, 8 files / 60 MB total for sale evidence.
- A legacy evidence migration offers read-only discovery, transactional reference replacement and retryable public-object purge. It resolves legacy order store ownership, rewrites only identified record cohorts, refuses unknown ownership and preserves shared catalogue/review media.

## Production work still required

Source tests and health/configuration checks cannot establish these real outcomes:

1. Configure and verify actual production SMS delivery, resend/expiry and staff access.
2. Verify real managed installation credentials and signature responses without disabling licensing.
3. Verify hosted transaction-capable MongoDB, not only database connectivity/index health.
4. Verify media persistence after restart. Review and run the legacy private-evidence migration against the intended database; existing public files are not made private by deploying code alone. Purge relevant CDN caches after approved removal.
5. Verify intended gateway mode, capture, failure, duplicate callbacks/webhooks, recovery and refunds.
6. Enter real rental offers, rates, security/advance, physical piece codes, fitting/measurements and policies. Run the actual preparation → handover → return → inspection → settlement process with assigned staff.
7. Re-upload original photos where old compression already removed detail. Benchmark actual bridal/jewellery batches on hosting RAM/CPU and network conditions.

No business prices, physical inventory or legal policy choices were fabricated. Owner-configured policy UI and setup checks are delivered; actual choices must be reviewed by the shop.

## Conditional next-phase items

The tracker explicitly contains three infrastructure proposals that remain conditional rather than being marked fixed:

| ID | Remaining proposal |
| --- | --- |
| BE-SETUP-09 | Representative large-catalogue query/latency budget and a caching policy with correct inventory invalidation |
| IMG-N07 | HEIC conversion after a tested decoder/browser support requirement; current supported sources are JPG/PNG/WebP |
| IMG-N08 | Direct signed object-storage uploads after choosing and validating provider identities, ingress limits and server normalization |

The PDF's three logo compression measurements are historical evidence and are not presented as measurements of actual bridal/jewellery originals.

## Live read-only results

The backend reported HTTP 200, ready=true, database connected and tenant indexes ready. It reported R2 configured, which does not prove an actual persistent upload or restart check.

OPTIONS /api/rentals/catalogue returned HTTP 204 with:

- Allowed Origin: https://jassi-bridal-bazzar-dharmshalas.onrender.com
- Credentials: true
- Requested Authorization and x-store-slug headers allowed

This confirms that specific preflight; it does not certify every API response or the user's actual OTP/licence/payment flow. The first health read timed out; the later read completed. The new source has not been deployed.

## Reproduce

Use the Node 20 executable selected by your environment:

- Frontend: npm run test:client -- --runInBand
- Build: CI=true npm run build (set CI through PowerShell on Windows)
- Backend: npm test from backend/
- Migration: npm run migrate:evidence -- --limit=100 starts read-only. Review backup/target ownership before using --apply or --delete-public.

Authoritative current frontend/build logs are .tmp/rental-findings-frontend-complete.log and .tmp/rental-findings-production-build.log. The final affected frontend follow-up is .tmp/rental-date-draft-tests.log. Backend source was unchanged in the 119-point follow-up; its complete/final affected logs remain .tmp/pdf-audit-backend-verified.log and .tmp/pdf-audit-migration-final.log. Earlier failing/overlapping runs are diagnostic history, not added to the final counts.

The optional product-link command's first localhost run had no backend on port 5000; it is not counted as passing live catalogue coverage. Its corrected pagination script was syntax checked.


## Backend folder consolidation

On 8 October 2026, at the user's request, the duplicate `backend-deploy/` folder was removed. `backend/` is now the only maintained backend source. Source files matched after line-ending normalization except the CORS test; its checks were combined in `backend/tests/cors.unit.test.js`. All 174 upload files unique to the removed folder were preserved under `backend/uploads/`. The existing backend environment and Git repository were retained.

References to `backend-deploy/` in earlier audit evidence describe the historical test location; the corresponding source now lives under `backend/`. No hosted Render service was deleted or reconfigured. See [backend-consolidation.md](backend-consolidation.md).
