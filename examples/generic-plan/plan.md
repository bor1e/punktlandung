# Feature Plan: CSV Export for Order History (`plan.md`)

- **Version:** 0.1.0
- **Status:** Draft — awaiting stakeholder clarification
- **Target:** Allow customers to export their order history as CSV.

## 1. Scope

- Add an "Export CSV" action on the Order History page.
- Respect active date and status filters.
- Include order number, date, total amount, currency, and status.

## 2. Unprovable Statements

- `U-1`: "Export must feel fast for typical customers." (No latency threshold or synchronous/async boundary defined.)

## 3. Open Questions

- `OQ-1` (**Keystone**): Should CSV generation run synchronously as a direct browser download, or asynchronously as a background job emailed to the customer?
- `OQ-2` (depends on `OQ-1` = sync): What is the maximum row limit for synchronous export before rejecting or truncating?
- `OQ-3`: Should customer PII (shipping street, phone number) be included or masked in the CSV?
- `OQ-4`: Which CSV delimiter and encoding should be used so Excel opens German/EU files cleanly?

## 4. Out of Scope (v1)

- Scheduled recurring exports.
- PDF or XLSX export formats.
