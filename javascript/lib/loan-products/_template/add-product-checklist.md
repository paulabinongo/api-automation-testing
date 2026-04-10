# Checklist: new `product_code`

- [ ] **`loanProductCatalog.js`**: `NEW_PRODUCT` object + `LOAN_PRODUCTS_BY_CODE['NEW_CODE']` (include **`primary_id_document_types`** if **POST …/documents** applies)
- [ ] **`loanProductCatalog.js`**: `appendProductSpecificIntakeValidation` → `case 'NEW_CODE':`
- [ ] **`loanProductCatalog.js`**: `productRequiresWholePhpPrincipal` (or shared flags on product) if special principal rules
- [ ] **`loan-products/registry.js`**: `ELIGIBILITY_BY_PRODUCT_CODE.NEW_CODE = evaluateNewProductEligibility`
- [ ] **New file**: `newProductEligibility.js` (or under `loan-products/<slug>/` — same pattern as **`personal-loan/personalLoanEligibility.js`**)
- [ ] **`loan-products/computationRegistry.js`**: `COMPUTATION_BY_PRODUCT_CODE.NEW_CODE` + preview math module
- [ ] **`loan-products/lifecyclePolicies.js`**: add `NEW_CODE` to document / PEP / Metrobank sets if those gates apply
- [ ] **`openapi.json`**: **`product_code`** enums (applications + **`GET …/loan-computation-preview`**) + request **`oneOf`** if shapes differ
- [ ] **`sampleData.js`** + tests + Postman (optional)
