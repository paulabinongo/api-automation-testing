/**
 * **Auto Loan** eligibility — placeholder until **`AUTO_LOAN`** (or your code) is fully specified.
 * Not registered in **`../registry.js`** until the product exists in **`loanProductCatalog.js`**.
 */

/**
 * @param {object} body
 * @param {{ referenceDate?: Date }} [options]
 * @returns {{ eligible: boolean, checks: { id: string, criterion: string, passed: boolean }[], failed_checks: string[] }}
 */
export function evaluateAutoLoanEligibility(body, options = {}) {
  void body
  void options
  const checks = [
    {
      id: 'auto_loan_not_implemented',
      criterion:
        'AUTO_LOAN eligibility not implemented — complete this file and register in registry.js when catalogue row exists',
      passed: false,
    },
  ]
  return {
    eligible: false,
    checks,
    failed_checks: checks.filter((c) => !c.passed).map((c) => c.criterion),
  }
}
