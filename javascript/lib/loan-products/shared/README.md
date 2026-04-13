# Shared (`loan-products/shared/`)

Cross-product helpers for eligibility and validation (e.g. borrower age on a reference date).

When you add a new **`product_code`** folder under **`loan-products/`**, import from here instead of duplicating date math — see **`personal-loan/`** and **`home-loan/`** **`borrowerAge.js`** usage.
