/**
 * Template — copy to **`../<product-slug>/`** and rename.
 * Wire **`evaluateNewProductEligibility`** → **`../registry.js`** (**`ELIGIBILITY_BY_PRODUCT_CODE`**)
 * only after **`NEW_PRODUCT_CODE`** exists in **`javascript/lib/loanProductCatalog.js`**.
 *
 * Replace **`NEW_PRODUCT_CODE`** with your real code (e.g. **`AUTO_LOAN`**).
 */

// const NEW_PRODUCT_CODE = 'NEW_PRODUCT_CODE'

/**
 * @param {object} body — same shape as **POST /loan-applications** (after catalogue validation)
 * @param {{ referenceDate?: Date }} [options]
 * @returns {{ eligible: boolean, checks: { id: string, criterion: string, passed: boolean }[], failed_checks: string[] }}
 */
export function evaluateNewProductEligibility(body, options = {}) {
  void body
  void options
  const checks = [
    {
      id: 'product_eligibility_not_implemented',
      criterion: 'Replace template eligibility in this folder — see _template/new-product/README.md',
      passed: false,
    },
  ]
  return {
    eligible: false,
    checks,
    failed_checks: checks.filter((c) => !c.passed).map((c) => c.criterion),
  }
}
