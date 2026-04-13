# Home Loan (`HOME_LOAN`)

| Concern | File(s) |
|--------|---------|
| Catalogue (purposes, LTV/term rules, IDs, rates, fees text) | **`homeLoanCatalog.js`** (this folder) |
| Intake validation | **`validateHomeLoanIntakeShape`** in **`javascript/lib/loanProductCatalog.js`** |
| Eligibility | **`homeLoanEligibility.js`** (registered in **`../registry.js`**) |
| Payment preview (level annual % buckets) | **`homeLoanComputation.js`** (**`../computationRegistry.js`**) |
| Sample payload | **`buildHomeLoanSampleApplication`** in **`javascript/lib/sampleData.js`** |

**Intake:** same **`borrower`** / **`employment`** shape as Personal Loan for the mock; **`metrobank_client_type`** is not used. **`additional_information`** adds **`property_appraised_value_cents`**, **`home_loan_applicant_category`** (**RESIDENT** \| **OFW**), **`collateral_property_type`** (**RESIDENTIAL**), **`collateral_is_vacant_lot`**, **`no_adverse_credit_history`**, optional **`home_equity_for_improvement`** (Home Equity purpose).
