# 5-Component Handoff Report — Frontend & UI Integration Survey

**Agent**: Explorer 1 (Frontend & UI Integration Specialist)  
**Date**: 2026-08-17  
**Working Directory**: `k:\projects\tunetags\.agents\explorer_survey_1`  
**Handoff Type**: Hard Handoff (Investigation Complete)  

---

## 1. Observation

Direct observations from codebase inspection of `k:\projects\tunetags`:
- **Files Present**:
  - `index.html` (1,570 lines, 73,100 bytes): Monolithic HTML file containing embedded CSS (`<style>` lines 63–829), Schema.org JSON-LD scripts (lines 831–1023), semantic markup (lines 1025–1305), and vanilla JavaScript (lines 1306–1567).
  - `tunetagz (2).html` (1,049 lines, 43,739 bytes): Older iteration of the landing page lacking FAQ accordion, JSON-LD, and carousel pause/a11y controls.
  - `manifest.json` (59 lines, 3,359 bytes): PWA manifest configured for `/Tune/` scope and standalone mode.
  - `robots.txt` and `sitemap.xml`: SEO metadata pointing to `https://devlokey.github.io/Tune/`.
  - Image Assets: `PRODUCT 1.png` (Spotify Code Tag), `PRODUCT 2.png` (Rocky Keychain), `POSTER 1.png`, `POSTER 2.png`, `TUNETAGZ LOGO.png`.
- **Product Display & Pricing**:
  - Hero carousel (`#hero`, lines 1066–1102) rotates `PRODUCT 1.png` (₹699) and `PRODUCT 2.png` (₹300) via JS carousel logic (`setHeroProduct` line 1405).
  - Products grid (`#products`, lines 1113–1180) hardcodes 3 static cards: Spotify Code Tag (`SPT-001`), Rocky Keychain (`RKY-001`), and Drop 03 (`DROP-03`, Coming Soon).
  - Price elements use intersection observer `animateCount()` (lines 1513–1545) for rolling number animations.
- **Call to Actions**:
  - Every CTA button in `index.html` (lines 1038, 1051, 1059, 1137, 1155, 1174, 1246, 1289) links exclusively to Instagram DM: `href="https://www.instagram.com/tune.tagz/"`.
- **Missing Full-Stack Features**:
  - Zero dynamic API calls (no `fetch` or `/api/*` endpoints).
  - No interactive Spotify track lookup, URI parsing, or scannable code generator.
  - No customer login/registration modal, session storage, or Google OAuth integration.
  - No Razorpay Checkout SDK script (`checkout.razorpay.com/v1/checkout.js`) or payment handler.
  - No order tracking UI or order status stepper.
  - No admin portal interface (`admin.html`).

---

## 2. Logic Chain

1. **Observation**: All product listings and CTA links are hardcoded to Instagram DM with no client-server data flow.
   **Inference**: The frontend was built purely as a marketing showcase. To transform it into an active e-commerce application, a client API communication layer must replace hardcoded elements.

2. **Observation**: Spotify Code keychain (`SPT-001`) is the flagship product with laser engraving on front (scannable code) and back (name/custom text), but currently requires manual DM communication.
   **Inference**: An in-browser interactive customizer component is essential. It must accept a Spotify song URL/URI, generate the scannable waveform code, provide a 3D/2D card flip preview (front: code, back: custom text), and construct the customization payload for backend order storage.

3. **Observation**: Requirement R3 requires Razorpay Indian payment processing (UPI, cards, netbanking) and R2 requires Email + Google OAuth customer authentication.
   **Inference**: The frontend requires:
   - An authentication modal supporting Email/Password login, Sign-up, and Google OAuth 2.0.
   - Dynamic navigation bar state reflecting logged-in user tokens (`localStorage.getItem('tunetagz_token')`).
   - A checkout modal capturing Indian shipping addresses (Name, Phone, Address, PIN).
   - Integration with Razorpay JS SDK (`https://checkout.razorpay.com/v1/checkout.js`) invoking `POST /api/payments/create-order` and `POST /api/payments/verify`.

4. **Observation**: Requirement R4 demands customer order tracking and R5 requires a developer admin portal with product image uploads.
   **Inference**: The frontend must provide:
   - An Order Tracking modal/page with a 5-step visual fulfillment timeline (`Received` -> `Engraving` -> `Quality Check` -> `Dispatched` -> `Delivered`).
   - A protected developer admin portal (`admin.html`) with product CRUD, `multer` image uploads to `/uploads`, stock status toggling, and order status updates.

---

## 3. Caveats

- **Network Scope & Spotify Scannable API**: Spotify's official scannable code service (`scannables.scdn.co`) can be fetched client-side or proxied through the backend server. A local SVG bar generator can also be implemented as an offline fallback.
- **PWA Manifest Scope**: `manifest.json` currently specifies `scope: "/Tune/"` (from GitHub Pages hosting). This should be updated to `"/"` when deployed with the Node.js/Express server.
- **Google OAuth Client ID**: In production/testing, Google OAuth requires `GOOGLE_CLIENT_ID` configured in backend environment variables and Google Cloud Console authorized origins.
- **Razorpay Test Mode**: Razorpay integration on the frontend will operate in test mode (`rzp_test_...`) until live merchant keys are provided.

---

## 4. Conclusion

The existing TuneTagZ frontend provides a strong visual and architectural baseline. The required transformation involves:
1. **Dynamic Catalog**: Fetching products from `GET /api/products` and rendering cards dynamically.
2. **Spotify Customizer**: Building an interactive 2-sided preview modal for Spotify soundwaves and laser text engraving.
3. **Authentication Modal**: Supporting JWT email/password and Google OAuth with persistent header session state.
4. **Razorpay Checkout**: Seamless modal checkout flow with Indian address validation and signature verification.
5. **Order Tracking**: Multi-step visual tracking timeline for customers.
6. **Developer Admin Portal**: Protected `admin.html` dashboard with `multer` product image uploads and order fulfillment control.

---

## 5. Verification Method

To independently verify the observations and analysis:
1. **Inspect Codebase Structure**:
   - Run `find_by_name` across `k:\projects\tunetags` to confirm file catalog.
   - Review `index.html` lines 1038–1289 to confirm all buttons link to Instagram DM.
   - Review `index.html` lines 1113–1180 to inspect static `.pcard` markup.
2. **Review Detailed Analysis**:
   - View `k:\projects\tunetags\.agents\explorer_survey_1\analysis.md` for full component specifications, data contracts, and design system mappings.
