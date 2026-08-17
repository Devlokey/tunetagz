# TuneTagZ Frontend Architecture & UI Integration Analysis

**Author**: Explorer 1 (Frontend & UI Integration Specialist)  
**Date**: 2026-08-17  
**Workspace**: `k:\projects\tunetags`  
**Status**: Comprehensive Investigation Complete  

---

## 1. Executive Summary & Current State Overview

The existing TuneTagZ frontend is a polished, high-performance static e-commerce landing page built with semantic HTML5, modern vanilla CSS3, and vanilla JavaScript. It features an emerald dark-mode color palette (`--bg: #0d1f13`, `--gold: #c9a84c`, `--cream: #e8e4c8`), custom typography (`Anton`, `Space Grotesk`, `DM Mono`), smooth micro-animations, accessible ARIA attributes, and structured Schema.org JSON-LD metadata.

### Key Finding:
Currently, the frontend operates **entirely without backend integration**. All "Order Now", "Shop Now", and CTA buttons redirect users to an Instagram Direct Message link (`https://www.instagram.com/tune.tagz/`). Products are hardcoded in static HTML, and there is no interactive Spotify code generator, live keychain preview widget, user authentication modal, payment checkout trigger, or order tracking interface.

To fulfill the requirements specified in `ORIGINAL_REQUEST.md`, the frontend must be transformed into a dynamic single-page web app / client layer that connects to the Node.js/Express REST API, provides an interactive Spotify engraving preview customizer, supports customer auth + Google OAuth, triggers the Razorpay payment modal, tracks live orders, and links to the developer admin portal.

---

## 2. File & Asset Inventory

| File Path | Size | Role / Description | Current Content Analysis |
|:---|:---|:---|:---|
| `index.html` | 73,100 B (1,570 lines) | Primary storefront landing page | Single-file architecture containing inline CSS (lines 63-829), JSON-LD (831-1023), HTML markup (1025-1305), and script logic (1306-1567). |
| `tunetagz (2).html` | 43,739 B (1,049 lines) | Legacy / alternative landing page draft | Predecessor of `index.html`. Lacks FAQ accordion, JSON-LD, ARIA dialog attributes, and carousel controls. Can be archived or ignored. |
| `manifest.json` | 3,359 B (59 lines) | Progressive Web App (PWA) manifest | Defines name ("TuneTagZ"), theme `#0d1f13`, inline SVG icons, shortcuts for Shop (`#products`) and FAQ (`#faq`). Currently configured with scope `/Tune/`. |
| `robots.txt` | 81 B (5 lines) | Search engine crawler rules | Allows all indexing; references `https://devlokey.github.io/Tune/sitemap.xml`. |
| `sitemap.xml` | 283 B (10 lines) | XML Sitemap | Single URL `<loc>https://devlokey.github.io/Tune/</loc>`. |
| `PRODUCT 1.png` | 2,457,803 B | Spotify Code Tag keychain product render | Transparent PNG (1536x1024) showing matte black metal tag with laser-engraved gold Spotify soundwave bars. |
| `PRODUCT 2.png` | 2,449,464 B | Rocky Keychain product render | Transparent PNG (1024x1536) showing 3D-printed maze pattern figure in matte black with steel keyring. |
| `POSTER 1.png` | 2,077,364 B | Spotify Code Tag marketing poster | Square poster (1254x1254) with background ambiance, branding, and Spotify Code Tag. |
| `POSTER 2.png` | 2,372,030 B | Rocky Keychain marketing poster | Square poster (1254x1254) showcasing Rocky keychain design. |
| `TUNETAGZ LOGO.png` | 17,286 B | Brand logo asset | Transparent PNG (423x318) featuring stylized TuneTagZ typography. |

### External Dependencies & CDN Resources
- **Google Fonts**:
  - `Anton` (Display font for hero & section titles)
  - `Space Grotesk` (Modern grotesque sans-serif for UI text, weights 300, 400, 500, 600, 700)
  - `DM Mono` (Monospace font for SKUs, prices, tags, eyebrows, weights 300, 400, 500)
- **Instagram**: External links to `https://www.instagram.com/tune.tagz/`

---

## 3. Product Catalog & UI Layout Analysis

### 3.1 Hero Carousel (`#hero`, lines 1066–1102)
- **Structure**: Two-column layout on desktop (left: headline, eyebrow, CTA row; right: floating product stage).
- **Carousel Mechanics**:
  - Contains `.hero-product-img` elements with `data-name` and `data-price` attributes:
    - Slide 0: `PRODUCT 1.png`, name "Spotify Code Tag", price "₹699"
    - Slide 1: `PRODUCT 2.png`, name "Rocky Keychain", price "₹300"
  - Interactive controls: Prev/Next arrow buttons, dot navigation, Pause/Play button (`#heroPause`), touch-swipe support (`touchstart`/`touchend`), and keyboard navigation (`ArrowLeft`, `ArrowRight`, `Home`, `End`).
  - Auto-advance: 5-second interval paused on hover, tab visibility change, or manual pause.

### 3.2 Products Grid (`#products`, lines 1113–1180)
- **Structure**: 3-column CSS grid (`.products-grid`, lines 372-376) rendering:
  1. **Spotify Code Tag (`SPT-001`)**: Price ₹699, badge "Bestseller", poster image `POSTER 1.png`, CTA button linking to Instagram.
  2. **Rocky Keychain (`RKY-001`)**: Price ₹300, badge "New", poster image `POSTER 2.png`, CTA button linking to Instagram.
  3. **Drop 03 (`DROP-03`)**: Price "TBA", badge "Coming Soon", placeholder container, CTA "Notify Me" linking to Instagram.
- **Card Interactive Effects**:
  - 3D perspective mouse-tilt effect on hover (`rotateY`, `rotateX` calculated from bounding rect in JS lines 1488-1510).
  - Gradient accent bar (`.pbar`) expands from 0% to 100% width on hover.
  - Price counter number roll animation on viewport intersection (`animateCount()` lines 1513-1545).

### 3.3 Product Spotlight (`#spotlight`, lines 1215–1250)
- Detailed feature spotlight dedicated to `Rocky Keychain` (`PRODUCT 2.png`), detailing matte black resin finish, silver steel hardware, and tracked shipping.

### 3.4 Navigation & Responsive Shell
- Fixed top navigation bar `#nav` that adds blurred background on scroll (`.scrolled`).
- Fullscreen mobile drawer (`#mobileDrawer`) triggered by animated `#hamburger`.
- Sticky bottom mobile order bar (`.mobile-order-bar`) visible on screens `<= 900px`.
- Accordion FAQ section (`#faq`) using semantic `<details>` and `<summary>`.

---

## 4. Spotify Customization & Live Preview System Design

### 4.1 Current Limitation
Currently, there is no in-browser customization tool. Users are told: *"DM us on Instagram @tune.tagz with your Spotify song link and name."*

### 4.2 Proposed Customizer Architecture
An interactive customization modal/drawer must be integrated for Spotify Code products (`SPT-001` and similar customizable items).

#### Component Workflow:
```
[User clicks "Customize & Order"]
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│                 CUSTOMIZER MODAL / CANVAS                   │
├─────────────────────────────────────────────────────────────┤
│ 1. Spotify Track Resolver:                                  │
│    - Input: Track URL / URI / Title search                  │
│    - Real-time Track Extraction (Spotify Track ID)          │
│    - Live Metadata Display (Album Art, Song Title, Artist)  │
│                                                             │
│ 2. Scannable Code Vector Generator:                         │
│    - Generates Spotify 23-bar soundwave code                │
│    - Uses Scannable API: scannables.scdn.co/uri/plain/svg/...│
│      or local SVG bar renderer                              │
│                                                             │
│ 3. Interactive 2-Sided Keychain Preview:                    │
│    ┌─────────────────────────────────────────────────────┐  │
│    │ [FRONT] Matte Black Tag + Laser-Gold Spotify Code   │  │
│    │ [BACK]  Matte Black Tag + Custom Engraved Name/Text │  │
│    │ [FLIP TAG BUTTON] (3D CSS Card Flip Animation)      │  │
│    └─────────────────────────────────────────────────────┘  │
│                                                             │
│ 4. Backside Text Customizer:                                │
│    - Input field: "Engraving Text / Name" (Max 30 chars)    │
│    - Font style picker (Classic Serif, Modern Sans, Script) │
│    - Live character counter & validation                    │
│                                                             │
│ 5. Keychain Hardware / Variant Option:                      │
│    - Ring finish: Gold Brass / Silver Steel / Matte Black   │
│                                                             │
│ 6. Order Summary & Price Breakdown:                         │
│    - Base Price (₹699) + Add-ons                            │
│    - CTA: "Proceed to Checkout"                             │
└─────────────────────────────────────────────────────────────┘
```

#### Customization Data Contract for Backend:
```json
{
  "productId": "SPT-001",
  "productName": "Spotify Code Tag",
  "unitPrice": 699,
  "quantity": 1,
  "customization": {
    "spotifyUrl": "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
    "spotifyUri": "spotify:track:4cOdK2wGLETKBW3PvgPWqT",
    "trackTitle": "Starboy",
    "artistName": "The Weeknd, Daft Punk",
    "albumArtUrl": "https://i.scdn.co/image/ab67616d0000b2734718e2b124f79258be7bc452",
    "engravedText": "Amal & Sarah • Forever",
    "engravingFont": "DM Mono",
    "hardwareFinish": "Gold Brass"
  }
}
```

---

## 5. User Interaction Points & Flow Mapping

### 5.1 Customer Authentication (Sign-Up / Login / OAuth)
- **Modal / Dropdown Component**:
  - `AuthModal`: Tabbed modal supporting **Login** and **Sign Up**.
  - **Email & Password**: Form inputs with validation, error messaging, password visibility toggle.
  - **Google OAuth 2.0 Button**:
    - Trigger button styled with Google branding: "Continue with Google".
    - Initiates OAuth redirect to `/api/auth/google` or launches Google Identity Services popup.
  - **Session Management**:
    - Stores JWT token in `localStorage` (`tunetagz_token`) and user object (`tunetagz_user`).
    - Updates navigation header dynamically:
      - Logged out: Displays `[ Login / Sign Up ]` button.
      - Logged in: Displays user initial badge / name, dropdown with `[ My Orders ]`, `[ Track Order ]`, `[ Admin Portal ]` (if `role === 'admin'`), and `[ Sign Out ]`.

### 5.2 Dynamic Product Catalog Fetching
- On page load, client executes `GET /api/products`.
- Renders product cards dynamically into `.products-grid`:
  - Product image (from `/uploads/...` or static URL)
  - Badge (`bestseller`, `new`, `limited`, `out_of_stock`)
  - Title, description, SKU, price formatting
  - Conditional CTA:
    - If `customizable === true`: "Customize & Buy" -> opens `CustomizerModal`.
    - If standard product: "Buy Now" / "Add to Cart" -> opens `CheckoutModal`.
    - If out of stock: Disabled "Out of Stock" button.
- Updates Hero Carousel slides and Spotlight dynamically from featured products.
- Implements skeleton loading state with dark green shimmer.

### 5.3 Checkout & Razorpay Payment Modal Integration
- **Checkout Modal**:
  - Step 1: Order Summary (product details, custom preview thumbnail, price breakdown, taxes, shipping = ₹0 Free).
  - Step 2: Shipping & Delivery Form:
    - Full Name, Mobile Number (10 digits, `+91`), Email Address.
    - Street Address, Apartment/Suite, City, State (dropdown of Indian states/UTs), PIN Code (6 digits).
  - Step 3: Payment Trigger (`Pay with Razorpay`):
    - Frontend sends order payload to `POST /api/payments/create-order` (includes bearer token if logged in, or guest payload).
    - Backend creates Razorpay order with amount in paise (`amount: price * 100`) and returns `order_id`, `razorpay_order_id`, `amount`, `key_id`.
    - Frontend dynamically loads Razorpay SDK (`https://checkout.razorpay.com/v1/checkout.js`) if not already loaded.
    - Initializes Razorpay options:
      ```javascript
      const rzpOptions = {
        key: data.key_id,
        amount: data.amount,
        currency: "INR",
        name: "TuneTagZ",
        description: "Custom Keychain Order #" + data.orderId,
        image: "TUNETAGZ%20LOGO.png",
        order_id: data.razorpay_order_id,
        handler: async function (response) {
          // Send verification payload to backend
          const verifyRes = await fetch('/api/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: data.orderId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            })
          });
          const verifyData = await verifyRes.json();
          if (verifyData.success) {
            showOrderSuccessModal(verifyData.order);
          } else {
            showToast('Payment verification failed. Please contact support.', 'error');
          }
        },
        prefill: {
          name: shippingData.name,
          email: shippingData.email,
          contact: shippingData.phone
        },
        theme: {
          color: "#0d1f13"
        }
      };
      const rzp = new Razorpay(rzpOptions);
      rzp.open();
      ```

### 5.4 Order Tracking & Customer Portal
- **Order Tracking Modal / Page (`#track` or `track.html` / `orders.html`)**:
  - Accessible via top nav link `Track Order`.
  - Allows lookup by **Order ID** (e.g. `TTZ-89421`) + Phone/Email, or auto-loads order history if user is logged in.
  - Displays **Visual Stepper / Status Timeline**:
    1. 🟢 **Order Placed / Payment Verified**
    2. 🟡 **In Production (Laser Engraving / 3D Printing)**
    3. 🔵 **Quality Inspection Completed**
    4. 🟣 **Dispatched & In Transit** (with Courier Partner name & AWB Tracking link)
    5. ⚪ **Delivered**
  - Displays interactive preview of what was ordered:
    - Spotify Track Link + Scannable Barcode Image.
    - Laser Engraved Custom Text.
    - Full Shipping Address & Invoice download button.

### 5.5 Developer Admin Portal (`/admin` or `admin.html`)
- Dedicated protected dashboard for developer/store administrators:
  - **Login protection**: Requires admin credentials (verified via `POST /api/auth/admin-login` or JWT role check).
  - **Tab 1: Product Catalog Manager**:
    - List all products in SQLite/PostgreSQL database.
    - Form to add new product: Name, SKU, Price, Description, Badge, Customizable checkbox, Stock Availability toggle.
    - Image upload via `multipart/form-data` handled by `multer` (stores in `/uploads` directory).
    - Edit existing products, update pricing, toggle active status, delete products.
  - **Tab 2: Order Fulfillment & Management**:
    - Live feed of all customer orders.
    - View customer details, customization parameters (Spotify URL, Spotify scannable code, engraved text), shipping address, payment status.
    - Status update dropdown: `Received` -> `Engraving` -> `Dispatched` (enter tracking AWB) -> `Delivered` -> `Cancelled`.
  - **Tab 3: Payment Logs & Transactions**:
    - Log of all Razorpay transactions, payment IDs, amounts, payment timestamps, refunds.

---

## 6. Frontend Architectural Requirements & Changes Needed

### 6.1 Modular Script Structure
To keep the codebase maintainable while maintaining high performance, we recommend structuring frontend scripts as clean modular files loaded via ES Modules or bundled into the application:

```
tunetags/
├── index.html              # Main customer-facing storefront
├── admin.html              # Developer admin management portal
├── js/
│   ├── api.js              # Centralized fetch wrapper with JWT interceptor & base URL
│   ├── auth.js             # Sign-up, login, Google OAuth, token management, header UI
│   ├── products.js         # Dynamic product rendering, skeleton loader, card animations
│   ├── customizer.js       # Spotify code generation, live 2D/3D tag preview, flip card
│   ├── checkout.js         # Shipping address form, Razorpay trigger & verification
│   ├── tracking.js         # Order tracking timeline, order lookup, customer dashboard
│   └── main.js             # App initialization, carousel, navbar, animations, event bus
├── css/
│   ├── style.css           # Core theme styles, layout, animations (extracted from index.html)
│   ├── customizer.css      # Customizer modal, 3D flip card, soundwave generator styles
│   ├── modals.css          # Auth, checkout, tracking modals & toast notifications
│   └── admin.css           # Admin portal dashboard styling
└── uploads/                # Directory for dynamic product images uploaded via admin
```

### 6.2 Design System Preservation
All new components (Modals, Customizer, Stepper, Admin Dashboard) must adhere to the established TuneTagZ design system:
- **Color Variables**:
  - Primary Background: `#0d1f13` (Deep forest green)
  - Secondary Background: `#0a1a0f` (Dark spruce)
  - Card/Modal Background: `rgba(10, 26, 15, 0.95)` with `backdrop-filter: blur(20px)`
  - Accent Gold: `#c9a84c` (Warm gold for badges, borders, icons, prices)
  - Glow Green: `#4ade80` / `rgba(34, 197, 94, 0.18)`
  - Primary Cream: `#e8e4c8`
  - Muted Text: `rgba(232, 228, 200, 0.45)`
- **Typography Hierarchy**:
  - Headings: `font-family: 'Anton', sans-serif`
  - Body & UI: `font-family: 'Space Grotesk', sans-serif`
  - Metadata, SKUs, Codes, Prices: `font-family: 'DM Mono', monospace`
- **Component Styling**:
  - 2px border radius, subtle 1px border `rgba(232, 228, 200, 0.08)`, gold hover accents.
  - Buttons: `.btn-primary` (cream background, dark text, lift animation) and `.btn-gold` (`#c9a84c` background).

---

## 7. Recommended Implementation Sequence

1. **Phase 1: API Client & Product Catalog Synchronization**
   - Create `js/api.js` with structured API endpoints (`/api/products`, `/api/auth`, `/api/orders`, `/api/payments`).
   - Refactor `index.html` to dynamically fetch and render products from `/api/products` with fallback to static mock data if API is offline.
2. **Phase 2: Customer Authentication UI**
   - Build `AuthModal` (Sign up / Login / Google OAuth trigger).
   - Update navigation bar with dynamic session state and user menu.
3. **Phase 3: Interactive Spotify Customizer & Live Engraving Preview**
   - Build `CustomizerModal` with Spotify URI parser, scannable bar visualizer, 3D flip card, and real-time custom text engraving.
4. **Phase 4: Razorpay Checkout & Order Placement**
   - Build `CheckoutModal` with Indian shipping address validation.
   - Integrate Razorpay SDK script and webhook/payment verification flow.
5. **Phase 5: Order Tracking & Customer History**
   - Build `TrackOrderModal` with 5-stage visual fulfillment stepper.
6. **Phase 6: Developer Admin Portal**
   - Build `admin.html` with product CRUD, image file upload via `multer`, and order fulfillment management.

---

## 8. Summary of Findings & Next Steps

The frontend foundation is visually stunning, highly responsive, and well-coded, but currently lacks all transactional and backend-integrated features. By systematically introducing modular API clients, an interactive Spotify tag customizer, Razorpay modal checkout, customer auth, order tracking, and an admin portal, TuneTagZ will become a complete, production-grade e-commerce application.
