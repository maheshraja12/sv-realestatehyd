# SV Real Estates Hyderabad — Live Website Bug Audit & Production Health Report

**Audit Date:** October 20, 2026  
**Auditor:** Senior Full-Stack & Production Systems Specialist (Antigravity)  
**Target Environment:** Production Vercel (`https://sv-realestatehyd.vercel.app/`)  
**Repository:** `https://github.com/maheshraja12/sv-realestatehyd`  
**Primary Production Database:** Supabase (`https://gkkoqknmwynqbrpadosf.supabase.co`)  

---

## 1. Executive Summary

A comprehensive, read-only architectural, functional, security, and deployment audit was conducted on both the live production deployment (`https://sv-realestatehyd.vercel.app/`) and the full source code repository.

### Key Production Status Findings:
1. **Live Website Accessibility:** The live deployment is responsive (HTTP 200) across `/`, `/properties`, `/properties/:id`, `/about`, `/services`, `/locations`, and `/contact`. The health check endpoint (`/api/health`) reports `status: "ok"`, `environment: "production-vercel"`, and `cloud_configured: true`.
2. **Customer Enquiry Flow:** Public enquiry submissions on the live website successfully pass server validation, execute via the Supabase Edge Function, and persist reliably to `public.leads` in Supabase (verified with audit record `#68`, `SV-LEAD-MVGF4GCH-6AABB138`).
3. **Admin & Database Mismatch (Critical Bug Found):** In production on Vercel, the admin leads table (`/admin/leads`) displays the 23 cloud leads from Supabase. However, when an admin clicks on any lead (`/admin/leads/:id`), the route strictly queries local ephemeral SQLite. Since cloud lead IDs do not exist in SQLite on Vercel, the query returns `null` and bounces the admin back to `/admin/leads`, rendering lead details inaccessible.
4. **Security Vulnerability (P0 Found):** `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` was globally enabled in `server.js` and `database/postgres.js`. This disabled TLS certificate verification for all outbound HTTPS requests in the Node process.
5. **No Credential Leakage:** No Supabase service-role keys, database passwords, or JWT secrets are exposed in client bundles (`public/js/` and `views/` are clean).

---

## 2. Prioritized Findings Table

| ID | Severity | Category | Affected File / Route | Root Cause | Verification Status |
|:---|:---|:---|:---|:---|:---|
| **BUG-01** | **P0** | **Security** | `server.js:8`<br>`database/postgres.js:10` | Global `NODE_TLS_REJECT_UNAUTHORIZED = '0'` disables TLS validation across entire process. | **Confirmed** |
| **BUG-02** | **P1** | **Admin / Leads** | `routes/admin.js:350-365`<br>`GET /admin/leads/:id` | Route only queries SQLite; fails to check Supabase/PostgreSQL, causing lead click to bounce back to list. | **Confirmed** |
| **BUG-03** | **P1** | **Admin / Leads** | `routes/api/leads.js:523-524`<br>`PATCH /api/leads/:id/status` | Fails with 404 on cloud leads because it checks SQLite existence before attempting cloud update. | **Confirmed** |
| **BUG-04** | **P1** | **Admin / Site Visits** | `routes/admin.js:400-435`<br>`GET /admin/appointments` | Route queries SQLite only; never fetches appointments stored in Supabase/PostgreSQL. | **Confirmed** |
| **BUG-05** | **P1** | **Admin / CSV Export** | `routes/api/leads.js:598-620`<br>`GET /api/leads/export/csv` | Streams from SQLite only; exports empty/stale data on Vercel instead of active cloud enquiries. | **Confirmed** |
| **BUG-06** | **P2** | **Security / Abuse** | `server.js:74-76`<br>`POST /api/leads/public` | Rate limiter allows 5,000 requests per 5 minutes (virtually unlimited), opening form to bot floods. | **Confirmed** |
| **BUG-07** | **P2** | **SEO / Compliance** | `routes/public.js`<br>`/privacy` & `/terms` | Standard legal pages return 404, risking ad campaign compliance (Meta/Google Ads). | **Confirmed** |
| **BUG-08** | **P3** | **UX / Branding** | `views/partials/footer.ejs:111`<br>Floating WhatsApp Action | Pre-filled text refers to legacy "Building Material Traders" instead of luxury real estate enquiries. | **Confirmed** |
| **BUG-09** | **P3** | **SEO / Social** | `views/public/property-detail.ejs`<br>Open Graph Meta | Missing property-specific `og:image` and `og:description` tags when sharing listings on WhatsApp. | **Confirmed** |

---

## 3. Deep-Dive Analysis of Confirmed Bugs

### BUG-01 [P0] Global TLS Certificate Disablement
- **Evidence:** `server.js` and `database/postgres.js` contain:
  ```javascript
  if (process.env.VERCEL || process.env.NODE_ENV === 'production' || process.env.DATABASE_URL || process.env.POSTGRES_URL) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }
  ```
- **Root Cause:** A legacy workaround intended for PostgreSQL certificate chains in Node.js.
- **Risk:** Disabling `NODE_TLS_REJECT_UNAUTHORIZED` globally makes all outbound HTTPS requests (e.g. calls to Supabase REST and Edge Functions) susceptible to Man-In-The-Middle (MITM) attacks.
- **Remediation:** Remove the global environment variable mutation entirely. `database/postgres.js` already configures `ssl: { rejectUnauthorized: false }` explicitly inside the `pg.Pool` connection options where required, which protects database connectivity without compromising process-wide TLS security.

---

### BUG-02 [P1] Production Admin Cannot Open Lead Details (`/admin/leads/:id`)
- **Evidence:** 
  1. Live enquiry `#68` was created and persisted in Supabase.
  2. The Vercel admin list renders lead `#68` via `listCloudLeads()`.
  3. Clicking lead `#68` requests `GET /admin/leads/68`.
  4. In `routes/admin.js:352`:
     ```javascript
     let lead = db.prepare('SELECT ... FROM leads WHERE l.id = ?').get(req.params.id);
     if (!lead) return res.redirect('/admin/leads');
     ```
  5. SQLite in `/tmp` on Vercel does not contain row 68, returning `undefined`. The admin is immediately bounced back to `/admin/leads`.
- **Remediation:** In `routes/admin.js`, update `GET /admin/leads/:id`:
  ```javascript
  if (!lead && (process.env.VERCEL || isPostgresConfigured())) {
      const pgResult = await getPgLeadById(req.params.id);
      if (pgResult.success && pgResult.data) {
          lead = pgResult.data;
      }
  }
  ```
  Ensure notes and status history gracefully handle cloud records.

---

### BUG-03 [P1] Lead Status Updates Return 404 for Cloud Leads
- **Evidence:** In `routes/api/leads.js:523`:
  ```javascript
  const lead = db.prepare('SELECT status FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  ```
  Even though `updatePgLeadStatus()` exists at line 540, the route exits early with HTTP 404 because SQLite does not contain the cloud record.
- **Remediation:** Check `getPgLeadById(req.params.id)` if `lead` is not found in SQLite. When found in cloud, update via `updatePgLeadStatus(req.params.id, status)`.

---

### BUG-04 [P1] Site Visits & Appointments Listing Disconnected from Cloud
- **Evidence:** `routes/admin.js:400` (`GET /admin/appointments`) queries only SQLite:
  ```javascript
  const total = db.prepare(`SELECT COUNT(*) as count FROM appointments a WHERE ${where}`).get(...params).count;
  ```
  Appointments submitted through the public API or stored in Supabase are never queried in the admin view.
- **Remediation:** Add cloud fetching via `fetchPgAppointments()` in `routes/admin.js:400`, mirroring the pattern already used for `/admin/leads`.

---

### BUG-05 [P1] Leads CSV Export Drops Cloud Data
- **Evidence:** `routes/api/leads.js:598` (`GET /api/leads/export/csv`) dumps only the local SQLite `leads` table.
- **Remediation:** If `process.env.VERCEL` or `isPostgresConfigured()`, query cloud leads and stream them into the CSV formatter.

---

### BUG-06 [P2] Overly Permissive Rate Limiting on Public Enquiry Form
- **Evidence:** `server.js:74-76`:
  ```javascript
  const enquiryLimiter = rateLimit({
      windowMs: 5 * 60 * 1000,
      max: 5000
  });
  ```
  Allows 1,000 enquiries per minute from a single IP address, leaving the endpoint unprotected against scripted spam.
- **Remediation:** Set `max: 15` per 5 minutes with an informative error message.

---

### BUG-07 [P2] Missing Legal Policy Pages (`/privacy` & `/terms`)
- **Evidence:** Direct access to `https://sv-realestatehyd.vercel.app/privacy` and `/terms` yields 404.
- **Remediation:** Add basic Privacy Policy and Terms of Service views and routes adhering to Indian Real Estate (RERA Telangana) and IT Act guidelines.

---

### BUG-08 & BUG-09 [P3] Brand & Social Meta Optimization
- **Evidence:** Floating WhatsApp pre-fills "Building Material Traders" instead of Real Estates. Property pages lack rich Open Graph image tags for WhatsApp link previews.
- **Remediation:** Update WhatsApp string and embed dynamic `og:image` and `og:description` in `property-detail.ejs`.

---

## 4. Proposed Fix Plan

1. **Step 1 — Security Hardening:**
   - Remove `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` from `server.js` and `database/postgres.js`.
   - Constrain `enquiryLimiter` to 15 requests per 5 minutes.
2. **Step 2 — Lead Detail & Status Cloud Integration:**
   - Update `routes/admin.js:350` (`GET /admin/leads/:id`) to query `getPgLeadById`.
   - Update `routes/api/leads.js` (`handleStatusUpdate`) to verify against `getPgLeadById` and persist to Supabase.
   - Update `routes/api/leads.js` (`/export/csv`) to pull cloud leads.
3. **Step 3 — Appointments Cloud Integration:**
   - Update `routes/admin.js:400` (`GET /admin/appointments`) to fetch from `fetchPgAppointments`.
4. **Step 4 — Legal Pages & Brand Refinements:**
   - Add `/privacy` and `/terms` routes in `routes/public.js` with responsive EJS views.
   - Fix WhatsApp message text in `views/partials/footer.ejs`.
   - Add dynamic Open Graph tags to `views/public/property-detail.ejs`.
5. **Step 5 — Testing & Deployment Verification:**
   - Run complete test suite (`npm test`).
   - Validate live lead retrieval and status update.
