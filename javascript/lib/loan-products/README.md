# Loan products (multi-product scaffold)

This folder holds **registration and documentation** for adding more loan types beside **`PERSONAL_LOAN`**. Shared catalogue validation still lives in **`javascript/lib/loanProductCatalog.js`** until you split a product into its own module.

## What to do when you add another product (e.g. `AUTO_LOAN`)

1. **Catalogue object** — In **`loanProductCatalog.js`**, add a frozen product definition (same general shape as **`PERSONAL_LOAN_PRODUCT`**: limits, `allowed_term_months`, `term_options`, LOVs, `fees_and_charges`, **`primary_id_document_types`** if **POST …/documents** applies, etc.).
2. **Register in `LOAN_PRODUCTS_BY_CODE`** — Add `[NEW_CODE]: NEW_PRODUCT`. **`buildLoanProductReferencePayload()`** maps **`Object.keys(LOAN_PRODUCTS_BY_CODE)`**, so **GET /v1/reference/loan-products** lists it automatically.
3. **Intake validation** — In **`appendProductSpecificIntakeValidation`** (same file), add a **`case 'NEW_CODE':`** branch (or delegate to **`./newProduct/validateIntake.js`**).
4. **Principal / term rules** — Reuse generic checks in **`validateApplicationAgainstCatalog`** where possible; hook product-only rules via **`productRequiresWholePhpPrincipal`** or similar switches in that file.
5. **Eligibility** — Implement **`evaluateNewProductEligibility(body, options)`** and register it in **`registry.js`** → **`ELIGIBILITY_BY_PRODUCT_CODE`**.
6. **Computation / previews** — Register **`COMPUTATION_BY_PRODUCT_CODE`** in **`computationRegistry.js`** (implement **`newProduct/computation.js`** if needed). **`GET /reference/loan-computation-preview`** accepts optional **`product_code`** and validates **`principal_cents` / `term_months`** against that catalogue row.
7. **Lifecycle** — Opt your **`product_code`** into **`lifecyclePolicies.js`** (document intake before submit, PEP compliance gate, Metrobank deposit confirm) only where those rules apply.
8. **OpenAPI** — Add **`product_code`** enum values, request schemas, and examples in **`javascript/mock-server/openapi.json`** (often **`oneOf`** or separate request bodies per product).
9. **Tests & samples** — Add **`buildNewProductSampleApplication`** in **`sampleData.js`**, MSW handlers if needed, and integration tests under **`javascript/test/integration/`**.

## Files

| Path | Role |
|------|------|
| **`catalog.js`** | **`getLoanProductByCode`**, **`registeredLoanProductCodes`** |
| **`registry.js`** | **`ELIGIBILITY_BY_PRODUCT_CODE`**, **`evaluateEligibilityForProduct`** |
| **`computationRegistry.js`** | **`COMPUTATION_BY_PRODUCT_CODE`**, **`computeLoanPreviewForProduct`** |
| **`lifecyclePolicies.js`** | Per-product submit / PEP / Metrobank gates |
| **`shared/borrowerAge.js`** | **`ageOnDate`**, **`addCalendarMonths`** (eligibility) |
| **`personal-loan/`** | **`personalLoanEligibility.js`**, **`personalLoanComputation.js`**, **`personalLoanOccupations.js`** + **`README.md`** |
| **`home-loan/README.md`** | **HOME_LOAN** (residential mortgage) pointers |
| **`auto-loan/README.md`** | Scaffold for another product |
| **`_template/add-product-checklist.md`** | Copy/paste checklist |

## Server entry

**`evaluateEligibilityForProduct`** (**`registry.js`**), **`computeLoanPreviewForProduct`** (**`computationRegistry.js`**), **`getLoanProductByCode`** (**`catalog.js`**), and lifecycle sets (**`lifecyclePolicies.js`**) are what **`server.js`** uses so create, preview, and gates stay product-agnostic.
