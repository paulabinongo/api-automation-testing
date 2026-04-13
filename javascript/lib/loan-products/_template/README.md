# Template: new loan product folder

Use this when you add another **`product_code`** (loan type / product type).

## Steps

1. **Copy** the folder **`new-product/`** to **`../<your-slug>/`** (e.g. **`../auto-loan/`**, **`../sme-loan/`**). Prefer **kebab-case** for the directory name.
2. **Rename** the files and exports (e.g. **`evaluateNewProductEligibility`** → **`evaluateAutoLoanEligibility`**, **`computeNewProductPreview`** → **`computeAutoLoanPreview`**).
3. **Register** the catalogue row in **`javascript/lib/loanProductCatalog.js`** (**`LOAN_PRODUCTS_BY_CODE`**, intake **`case`**, etc.) — or follow the **Home Loan** pattern with a local **`productCatalog.js`** under your slug and import from **`loanProductCatalog.js`** only where the server expects a single map.
4. **Wire** **`../registry.js`**, **`../computationRegistry.js`**, and **`../lifecyclePolicies.js`** (see **`add-product-checklist.md`**).
5. **Remove** this template-only copy from version control if you duplicated **`new-product/`** into a real product folder and no longer need the generic template files there.

The checklist **`add-product-checklist.md`** (same directory) lists every touchpoint including OpenAPI and tests.
