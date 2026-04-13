# Personal Loan (`PERSONAL_LOAN`)

Implementation is **not** fully moved under this folder yet; it stays in the main lib for backward compatibility.

| Concern | Primary file(s) |
|---------|------------------|
| Product definition, LOVs, **`LOAN_PRODUCTS_BY_CODE`**, intake validation | **`javascript/lib/loanProductCatalog.js`** |
| Eligibility (Step 6+ checks) | **`personalLoanEligibility.js`** (this folder; registered in **`../registry.js`**) |
| Add-on / EIR computation preview | **`personalLoanComputation.js`** |
| Occupation LOV | **`personalLoanOccupations.js`** |
| Sample payloads | **`javascript/lib/sampleData.js`** |

For a net-new slug, copy **`../_template/new-product/`** or follow **`../auto-loan/README.md`**, then register eligibility (**`../registry.js`**), computation (**`../computationRegistry.js`**), and lifecycle gates (**`../lifecyclePolicies.js`**) as needed.
