# Auto Loan (placeholder — `AUTO_LOAN`)

| File | Role |
|------|------|
| **`autoLoanEligibility.js`** | Stub **`evaluateAutoLoanEligibility`** — replace rules, then register in **`../registry.js`**. |
| **`autoLoanComputation.js`** | Stub **`computeAutoLoanPreview`** — register in **`../computationRegistry.js`** when preview is required. |

Wire-up order (same as any new product):

1. **`javascript/lib/loanProductCatalog.js`** — frozen **`AUTO_LOAN`** row + **`LOAN_PRODUCTS_BY_CODE`**, intake **`case`**, principal flags if needed.
2. **`../registry.js`** — **`AUTO_LOAN: evaluateAutoLoanEligibility`**
3. **`../computationRegistry.js`** — **`AUTO_LOAN: computeAutoLoanPreview`** (optional until preview is defined)
4. **`../lifecyclePolicies.js`** — add **`AUTO_LOAN`** to document / PEP / Metrobank **`Set`**s where applicable
5. **`openapi.json`**, **`sampleData.js`**, tests — see **`../_template/add-product-checklist.md`**

Stubs are **not** registered yet, so they do not affect **`PERSONAL_LOAN`** / **`HOME_LOAN`**. Copy **`../_template/new-product/`** if you prefer a fresh folder name (e.g. **`motorcycle-loan/`**).
