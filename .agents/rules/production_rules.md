# Production App Rules

CRITICAL INSTRUCTIONS FOR MY PRODUCTION APP (Render + Firebase / Database + Google Drive):

1. DO NOT DELETE OR OVERWRITE EXISTING DATA:
   - Under no circumstances should existing database entries be deleted, formatted, or reset during updates.
   - Preserve all existing User Accounts, Usernames, Passwords, and Role permissions without modifying IDs or passwords.
   - Retain all historical Assembly Logs, Scooter Serial Numbers, Stock Logs, Challans, Battery/Charger Sales, Warranty Claims, and Buyer Records.

2. PRESERVE DATABASE STRUCTURE & SERVER CONFIGURATION:
   - Use the existing database (Firebase Firestore / Render DB / warehouse_db.json) without changing existing column names or record keys.
   - Ensure all database schema changes are strictly ADDITIVE (adding new optional fields without removing existing ones).

3. GOOGLE DRIVE BACKUP & RESTORE INTEGRATION:
   - Ensure the Google Drive backup integration is fully functional for automated and manual database backups.
   - When performing a backup or restore, ensure existing data is backed up before any operation, and restore processes merge or safely replace data without corrupting serial number sequences.

4. LOGIN & API SERVER INTEGRATION:
   - Use dynamic API base URL resolution so the client connects seamlessly to the hosted Render server.
   - Ensure login authenticates valid password credentials immediately without blocking legit users.

5. PRESERVE THE PURCHASE SECTION:
   - The Purchase Section (StockAdjustment.tsx and SearchConsole.tsx Container Search) is as critical as the assembly section.
   - The Bill Numbers, Invoice Numbers, and Shortage Data are recorded via the server into warehouse_db.json and backed up to Google Drive.
   - NEVER modify or delete the Purchase Section features, and NEVER tamper with how the purchase data is routed through the server to the Google Drive backup system.

6. DECOUPLE DATA FROM EPHEMERAL FILESYSTEM:
   - Render restarts wipe local files (like warehouse_db.json). If the server falls back to hardcoded DEFAULT arrays, deleted data will magically reappear and overwrite user intent.
   - ALL master data (Models, Chassis, Assembly, Inventory) must eventually be read from and written to a persistent external database (Firebase Firestore).
   - Never rely on server.ts hardcoded fallback arrays for production database state.

7. SUPPLIER NAME & ASSEMBLY PREFIXING:
   - Always ensure supplierName is preserved in StockLog and Inventory data.
   - The Assembly section uses 3-column prefixing (Chassis, Motor, Controller). Do not remove or alter this prefixing logic.
   - All data must automatically sync to Firebase, which acts as the Single Source of Truth.
