# SV Real Estates — Enquiry System & Database Connection Map

This document outlines the real, verified architecture, file paths, endpoints, environment variables, and data flow for the SV Real Estates enquiry and appointment scheduling system.

---

## 1. System Architecture Map

```
PUBLIC WEBSITE
    │
    ▼
ALL ENQUIRY BUTTONS
    │ (Auto-bound & explicit onclick handlers across all pages)
    ▼
ONE SHARED ENQUIRY FORM
    │ (views/partials/enquiry-modal.ejs — 4 required fields)
    ▼
FORM SUBMISSION HANDLER
    │ (handlePublicEnquirySubmit() in public/js/main.js)
    ▼
BACKEND API / SERVER ACTION
    │ (POST /api/leads/public in routes/api/leads.js)
    ▼
DATABASE CLIENT AND CONNECTION
    │ (node:sqlite DatabaseSync with WAL mode in database/db.js)
    ▼
PERSISTENT LEADS / ENQUIRIES TABLE
    │ (data/svrealestate.db — tables: leads, appointments)
    ▼
ADMIN AUTHENTICATION AND AUTHORIZED DATA FETCH
    │ (requireAuth in middleware/auth.js & GET /admin/leads in routes/admin.js)
    ▼
ADMIN PORTAL LEADS / ENQUIRIES TABLE
      (views/admin/leads.ejs & views/admin/lead-detail.ejs)
```

---

## 2. Layer-by-Layer Implementation Details

### Layer 1: Public Website
* **Files**:
  * `views/public/home.ejs` (Homepage hero, featured properties, CTA sections)
  * `views/public/properties.ejs` (Property listings catalog)
  * `views/public/property-detail.ejs` (Single property detail page)
  * `views/public/about.ejs` (Company background)
  * `views/public/services.ejs` (Advisory and consultation services)
  * `views/public/locations.ejs` (Prime Hyderabad localities)
  * `views/public/contact.ejs` (Direct contact and callback request)
  * `views/partials/header.ejs` (Header CTA button)
  * `views/partials/footer.ejs` (Footer consultation links)

### Layer 2: All Enquiry Buttons
* **Implementation**:
  * Explicit click handlers call `openEnquiryModal(propId, propTitle, propCode, propCategory)`
  * Universal auto-binder `initButtonAutoBindings()` in `public/js/main.js` scans the DOM on load and intercepts all buttons or links with text matching `"Enquire"`, `"Consultation"`, `"Schedule Meet"`, `"Site Visit"`, or `"Book Visit"`.
  * Every button opens the **exact same** modal dialog (`#enquiryModal`).

### Layer 3: One Shared Enquiry Form
* **File**: `views/partials/enquiry-modal.ejs`
* **Form ID**: `#publicEnquiryForm`
* **The 4 Required Fields**:
  1. **Full Name**: `<input type="text" id="modalCustomerName" name="full_name" required>`
  2. **Phone Number**: `<input type="tel" id="modalPhone" name="phone_number" required>`
  3. **Preferred Appointment Date & Time**:
     - Date: `<input type="date" id="modalAppointmentDate" name="appointment_date" required>`
     - Time Slot: `<select id="modalAppointmentTime" name="appointment_time" required>` (Morning, Afternoon, Post-Lunch, Evening, Late Evening)
  4. **What Are You Looking For?**: `<select id="modalPropertyRequirement" name="property_requirement" required>` (Residential Plot, Villa, Apartment, Commercial Property, Other)
* **Submit Button**: `#modalSubmitBtn` with loading state and `#modalErrorAlert` inline banner.

### Layer 4: Form Submission Handler
* **File**: `public/js/main.js`
* **Function**: `handlePublicEnquirySubmit(e)`
* **Responsibilities**:
  * Client-side validation: verifies full name (min 2 chars), phone number (valid 10 digits), appointment date, appointment time slot, and property requirement.
  * Disables submit button and shows loading spinner.
  * Submits payload via `fetch('/api/leads/public', { method: 'POST', ... })`.
  * Displays inline error message on failure or activates `#modalSuccess` on success.
  * Updates WhatsApp link with personalized pre-filled message and reference code.

### Layer 5: Backend API Endpoint
* **File**: `routes/api/leads.js`
* **Endpoint**: `POST /api/leads/public`
* **Controller**:
  * Validates inputs using `validateEnquiryData` in `middleware/validation.js`.
  * Generates unique lead code formatted as `SV-LEAD-XXXXXX`.
  * Sanitizes inputs using `xss`.
  * Checks for rapid double-click duplicates within a 2-second window.
  * Inserts the record into the persistent database.
  * Automatically creates a linked site visit appointment in the `appointments` table.
  * Triggers in-app admin notifications.
  * Responds with `HTTP 201 Created` and `{ lead_code: "SV-LEAD-XXXXXX" }`.

### Layer 6: Database Client & Connection
* **File**: `database/db.js`
* **Technology**: Node.js Built-in SQLite (`node:sqlite` DatabaseSync module)
* **Operating Mode**: Write-Ahead Logging (`WAL` mode) with foreign keys enabled and busy timeout set to 5000ms.
* **Environment Variable Support**: Loads `process.env.DATABASE_PATH || process.env.DB_PATH`, falling back to `data/svrealestate.db`.
* **Database File**: `data/svrealestate.db` (Persisted locally on disk; survives application restarts).

### Layer 7: Persistent Leads Table Schema
* **Database File**: `data/svrealestate.db`
* **Table**: `leads`
* **Key Columns**:
  | Column Name | Type | Description |
  | :--- | :--- | :--- |
  | `id` | `INTEGER PRIMARY KEY` | Auto-incrementing unique identifier |
  | `lead_code` | `TEXT UNIQUE` | Formatted identifier (e.g. `SV-LEAD-000130`) |
  | `full_name` / `customer_name` | `TEXT` | Customer full name |
  | `phone_number` / `phone` | `TEXT` | Customer 10-digit mobile number |
  | `appointment_date` / `preferred_visit_date` | `TEXT` | Selected appointment date (YYYY-MM-DD) |
  | `appointment_time` | `TEXT` | Selected time slot (e.g. 10:00 AM - 12:00 PM) |
  | `property_requirement` | `TEXT` | Looking for (Residential Plot, Villa, etc.) |
  | `status` | `TEXT` | Default: `'new'` |
  | `created_at` | `TEXT` | Automatic UTC timestamp `datetime('now')` |

### Layer 8: Admin Authentication & Data Fetch
* **Files**:
  * `middleware/auth.js` (`requireAuth` middleware verifies active session cookie)
  * `routes/admin.js` (`GET /admin/leads` queries `SELECT * FROM leads ORDER BY created_at DESC`)
  * `routes/admin.js` (`GET /admin/leads/:id` queries single lead with full notes & status history)
  * `routes/admin.js` (`GET /admin/dashboard` queries lead metrics & recent enquiries)

### Layer 9: Admin Portal Leads Table
* **File**: `views/admin/leads.ejs`
* **Displayed Columns**:
  1. Code (`SV-LEAD-XXXXXX`)
  2. Customer Name
  3. Phone Number (click-to-call)
  4. Appointment Date
  5. Appointment Time
  6. Property Requirement
  7. Enquiry Status (inline dropdown updater)
  8. Submission Date
  9. Actions (View details, Call, WhatsApp)
* **Lead Detail View**: `views/admin/lead-detail.ejs` (Shows complete customer information, requirement, date & time, attached property, and notes history).

---

## 3. Environment Variables Reference

| Variable | Purpose | Default / Example Value |
| :--- | :--- | :--- |
| `DATABASE_PATH` | Path to persistent SQLite file | `./data/svrealestate.db` |
| `PORT` | Primary web server port | `3000` |
| `NODE_ENV` | Environment mode | `development` / `production` |
| `SESSION_SECRET` | Secret key for session encryption | 64-character random string |
| `ADMIN_EMAIL` | Administrator login email | `admin@svrealestate.com` |
| `ADMIN_PASSWORD` | Administrator login password | `Admin@SV2024` |
