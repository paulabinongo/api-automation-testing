# New product (copy me)

After copying this folder to **`../<slug>/`**:

| Step | Action |
|------|--------|
| 1 | Replace **`NEW_PRODUCT_CODE`** in **`eligibility.js`** / **`computation.js`** comments with your real enum (e.g. **`AUTO_LOAN`**). |
| 2 | Rename **`evaluateNewProductEligibility`** / **`computeNewProductPreview`** to **`evaluate<Your>Eligibility`** / **`compute<Your>Preview`**. |
| 3 | Implement rules using **`../shared/borrowerAge.js`** and (if needed) a **`productCatalog.js`** beside these files — see **`../home-loan/`** or **`../personal-loan/`**. |
| 4 | **`import`** your implementations in **`../registry.js`** and **`../computationRegistry.js`**. |
| 5 | Complete **`javascript/lib/loanProductCatalog.js`** and **`../lifecyclePolicies.js`** per **`../add-product-checklist.md`**. |

Until implemented, the template eligibility returns **`eligible: false`** and computation returns **`null`** (unsupported preview).
