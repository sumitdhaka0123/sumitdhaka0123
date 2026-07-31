# VOLTSTOCK: SENZO ELECTRIC INDIA
## Corporate Operations & Operator Manual
*A Unified Full-Stack Platform for Electric Scooter Assembly, Real-Time Inventory Control, GPS Employee Auditing, and Live Google Sheets Synchronization.*

---

## 1. Executive Summary & Platform Overview

**VoltStock** is a customized full-stack enterprise resource planning (ERP) and operational auditing system designed specifically for **Senzo Electric India**. The platform bridges the gap between physical workshop operations, real-time inventory ledger adjustments, warehouse field-staff tracking, and central cloud spreadsheet ledgers.

### Core Technical Pillars:
1. **Client Interface**: React 18 with Vite, Tailwind CSS, Recharts for analytics, and Framer Motion for secure UI state transitions.
2. **Security & Session Persistence**: Local session restoration combined with role-based feature gating.
3. **Hardware Integrations**: High-performance, browser-based physical QR/Barcode camera scanner with auto-focus optimization and smart duplicates cooling-down.
4. **Physical Geolocation Auditing**: Real-time GPS verification with 4-second polling intervals and hard background permission enforcement.
5. **Data Mirroring**: Bidirectional REST API architecture mapping local states directly into live, central Google Sheets workbooks using secure proxies.

---

## 2. Comprehensive Feature Breakdown

### 2.1 Role-Based Access Control (RBAC) System
VoltStock secures operational data by segregating features into five specialized user profiles:

| Role Name | Scope of Permissions | Key Responsibilities |
| :--- | :--- | :--- |
| **Admin** | Unlimited master access. | System configurations, OAuth sync management, catalog editing, staff GPS map monitoring. |
| **Assembly Operator** | Production line write access. | Operating assembly queues, scanning/recording component serial numbers (Chassis, Motors, Controllers). |
| **Inventory Manager** | Ledger write access. | Logging container stock imports (In), adjusting inventory balances, checking stock logs. |
| **Dispatch Executive** | Shipping/Dispatch access. | Scanning chassis serials for delivery, verifying real-time coordinates, loading logistics data. |
| **Salesperson** | Retail & Battery Sales access. | Allocating batteries/chargers, registering buyers, submitting retail invoices. |

---

### 2.2 Geolocation Enforcement & Anti-Fraud Engine
To guarantee that dispatch operations and employee shift activity occur physically on-site at the **Senzo Electric India Warehouse Yard**, VoltStock incorporates a non-bypassable background GPS tracking service:
* **Continuous Active Polling**: When a user logs in, the browser establishes a background interval that polls device coordinates (`navigator.geolocation.getCurrentPosition`) every **4,000 milliseconds (4 seconds)**.
* **Revocation Lockout Overlay**: If an operator attempts to revoke browser location permissions, disable device GPS, or simulate mock coordinates, the application instantly locks the screen with a frosted rose background overlay (`#location-blocked-overlay`). Work cannot resume until physical location is verified.
* **Live GIS Tracking Maps**: Managers can view live coordinates on interactive GIS tracking panels (**Staff Unified Map** & **Location Trails Map**), complete with physical geofence boundaries and sequential breadcrumb trails demonstrating employee routes.
* **Audit Trail Integration**: Verified lat/long coordinate data is automatically logged to `/api/users/location` and synced directly into the designated Google Sheet for payroll, attendance, and compliance audits.

---

### 2.3 High-Performance QR & Barcode Scanner Engine
VoltStock includes a custom-built, camera-level scan interface powered by the `html5-qrcode` engine, replacing sluggish mock scanners:
* **Advanced Video Constraints**: Requests high-resolution video streams (ideal: 1280x720, up to 1920x1080) and enforces `facingMode: "environment"` to prioritize the high-autofocus rear cameras of mobile devices.
* **Scan Cool-down Safeguards**: A 2,500ms (2.5-second) cool-down timer prevents double-scanning or accidental serial duplication of identical barcodes.
* **Live Visual Overlay & Target Frame**: Displays a dynamic green laser overlay line and active radar ping, giving immediate real-time feedback to the operator.
* **State-Linked Sound & Haptic Cues**: Generates color-coded success (green) or failure (red) screen tints with contextual error alerts (e.g., *"Duplicate serial scanned"*, *"Target quantity reached"*).
* **Damaged QR Code Override**: Provides a fast manual entry keyboard toggle for barcodes that are physically torn, greasy, or illegible.

---

### 2.4 Multi-Stage Assembly & Component Pairing Pipeline
This module handles the physical production line, guiding operators from raw parts to complete, serialized vehicles:
1. **Single Assembly**: An operator selects a target Product Model and Color. The system calculates the **Remaining Unassembled Stock** (Imported components minus already assembled scooters) to prevent overselling or data entry errors. The operator then records:
   - **Chassis Serial Number** (via QR scanner or manual entry)
   - **Motor Serial Number**
   - **Controller Serial Number**
   - **Compatible Battery & Charger Serial Ranges**
2. **Bulk Assembly**: Designed for high-volume shifts. Operators can batch-scan up to 50 chassis, motors, or controller serials in rapid succession, saving hours of manual data logs.
3. **Component Swaps / Retrofitting**: Allows technicians to exchange defective batteries or controllers on already-assembled units while maintaining a strict, non-erasable revision trail in the master search database.

---

### 2.5 Container Imports & Stock Ledger Logs
The inventory dashboard governs the raw inputs and bulk cargo received from international and domestic suppliers:
* **Cargo Container Imports**: Logs bulk shipments of high-voltage Lithium batteries and smart chargers. Managers enter:
   - Supplier Name & Container ID
   - Product Series / Capacity Rating
   - Range Start and Range End serial numbers (e.g., `LIT-BAT-1001` to `LIT-BAT-1150`)
* **Stock Drawdown Accounting**: Dynamically updates stock counts. When a scooter is assembled, raw parts are decremented. When a scooter is dispatched, finished inventory is adjusted.
* **Non-Destructive Audit Ledger**: Every transaction (Stock-In, Assembly, Dispatch, Local Purchases, Adjustment) is logged with the operator’s timestamp, colorway details, and unique usernames.

---

### 2.6 Battery & Charger Sales (POS Hub)
A high-throughput portal dedicated to standalone component allocation and wholesale transactions:
* **Warranted Battery Outflow**: Allows the sales team to dispatch ranges of batteries to dealers. They select the Battery Series, specify starting and ending serial numbers, select/register the Wholesale Buyer, and assign custom warranties (e.g., 24 months, 36 months).
* **Hold & Release Lifecycle**: Enables sales representatives to reserve charger batches on "Hold" for specific retail clients or vehicle holds, with secondary confirmation buttons to "Release Hold" or "Finalize Dispatch".

---

### 2.7 Cross-Referencing Diagnostic Search Console
The system’s universal search index provides complete component-level tracing:
* **Single-Field Universal Query**: Input any single identifier—a Chassis Number, Motor Serial, Controller ID, Battery Code, or Charger Range.
* **Instant Lineage Reconstruction**: The engine scans all warehouse archives and produces a complete historical report:
   - **Sourcing**: Original container import ID, importing supplier, and entry date.
   - **Assembly**: Exact date/time, the specific assembly line operator, model specs, and colorway.
   - **Sales/Dispatch**: Dispatch Executive name, buyer profile, GST number, invoice references, and GPS coordinates recorded at the moment of shipping.
   - **Warranty Details**: Live active status, months remaining, and previous component claim history.

---

### 2.8 Bidirectional Google Sheets Synchronization
The core server mirrors all transactional data to a Google Sheets workbook. This guarantees office administrators have instant access without needing specialized databases:
* **Custom Workspace Mappings**: Admins can bind specific spreadsheets and columns to separate VoltStock tables (Assembled Units, Sales, Stock Adjustments, Employee Telemetry).
* **Navigation-Triggered Sync**: Every time an operator changes tabs or navigates to a new screen, the app fires a background sync to fetch the newest entries logged by office-based clerks directly in Google Sheets.
* **Secure Token Proxy**: Integrates with Google OAuth. Credentials are kept entirely server-side, ensuring key safety while working in browser contexts.

---

## 3. Step-by-Step Operator Guide

### 3.1 Operating the QR Scanner
1. Open the **Assembly Pipeline** or **Stock Ledger** and tap **Launch QR Scanner**.
2. Grant the browser camera permissions if prompted (the camera will prioritize your device’s rear-facing lens).
3. Align the green target frame over the QR code or barcode on the scooter’s chassis or motor housing.
4. Upon scanning, the screen will flash **Success Green**, play an audible indicator, and append the code to your scan list.
5. If the barcode is unreadable, toggle **Manual Entry**, type the code, and click **Add**.

### 3.2 Dispatching a Scooter (As a Dispatch Executive)
1. Navigate to **Dispatch Portal**.
2. Select the wholesale or retail buyer from the registered list.
3. Your device will run an automatic background GPS location check (ensure your browser's location prompt is accepted!).
4. Tap **Scan Outward Chassis** and scan the QR code located on the front neck-stem of the scooter.
5. Review the paired component specs (Motor, Battery, Charger) to verify correctness.
6. Click **Confirm & Dispatch**. The system locks the transaction, updates Google Sheets, and records your current GPS coordinates.

---

## 4. How to Generate / Print this Manual as a Corporate PDF

To convert this manual into a beautifully formatted, print-ready PDF for your client:

1. **In the Application Viewport**:
   Navigate to the **Documentation & Help Panel** inside the VoltStock sidebar (accessible to Admins).
2. **Launch Print Command**:
   Press **`Ctrl + P`** (on Windows) or **`Cmd + P`** (on Mac) to open the browser’s native print interface.
3. **Adjust Browser Print Settings**:
   - **Destination**: Choose **Save as PDF** or **Adobe PDF**.
   - **Paper Size**: Set to **A4** or **Letter**.
   - **Margins**: Choose **Default** or **Minimum** for optimal spacing.
   - **Options**: Enable **Background Graphics** (this ensures the elegant colored headers, borders, and table stripes render beautifully).
4. **Export**:
   Click **Save** and choose your destination directory. You now have a highly polished, branded corporate PDF document ready to show to your client!
