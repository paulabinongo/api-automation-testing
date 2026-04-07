/**
 * Loan product definitions for GET /v1/reference/loan-products and create-application validation.
 * Catalogue is **PHP-only**: **`principal_cents`** and **`annual_income_cents`** are **PHP centavos** (1 PHP = 100 centavos).
 */

/** @param {number} pesos Whole PHP */
function phpToCentavos(pesos) {
  return Math.round(pesos * 100)
}

const personalTermOptions = Object.freeze([
  Object.freeze({
    term_months: 12,
    monthly_add_on_rate_percent: 1.75,
    annual_contractual_rate_percent: 36.742,
  }),
  Object.freeze({
    term_months: 18,
    monthly_add_on_rate_percent: 1.75,
    annual_contractual_rate_percent: 36.676,
  }),
  Object.freeze({
    term_months: 24,
    monthly_add_on_rate_percent: 1.5,
    annual_contractual_rate_percent: 31.459,
  }),
  Object.freeze({
    term_months: 36,
    monthly_add_on_rate_percent: 1.5,
    annual_contractual_rate_percent: 25.976,
  }),
])

/** Metrobank-style Personal Loan — sole product in this sandbox (PHP). */
export const PERSONAL_LOAN_PRODUCT = Object.freeze({
  product_code: 'PERSONAL_LOAN',
  loan_type: 'personal',
  name: 'Personal Loan',
  bank_marketing_name: 'Metrobank Personal Loan',
  currency: 'PHP',
  principal_minor_unit_label: 'centavo (1 PHP = 100 centavos)',
  general_information:
    'Metrobank Personal Loan can help you fund your large ticket transactions. You can use it for personal purchases, home repairs, weddings, tuition fees, debt consolidation, medical emergencies or any other unexpected expenses.',
  eligibility: Object.freeze([
    'Be a Filipino citizen',
    'Be at least 21 years old at the time of loan application and 65 years old upon loan maturity',
    'Have a gross annual income of at least PHP 250,000',
    'Have an existing credit card',
    'If employed: be of regular status with current employer for at least 1 year',
    'If self-employed: be at least 2 years in the current business',
  ]),
  credit_evaluation_note:
    'Applications of eligible applicants shall be subject to credit evaluation.',
  tenor_heading: 'Tenor or Loan Terms',
  term_options: personalTermOptions,
  fees_and_charges: Object.freeze({
    disbursement_fee_php: 1500,
    documentary_stamp_tax: Object.freeze({
      description: '0.75% of the loan amount (for loans above Php 250,000)',
      rate_percent: 0.75,
      threshold_principal_php: 250_000,
    }),
    late_payment_fee_php_per_incidence: 850,
    pre_termination_fee: Object.freeze({
      description: '5% of Outstanding Balance or Php 550, whichever is higher',
      percent_of_outstanding_balance: 5,
      minimum_php: 550,
    }),
    disclaimer:
      'Fees and charges are subject to change without prior notice. You can use Metrobank’s Personal Loan Calculator to compute for the monthly amortization based on your preferred loan amount and loan tenor.',
  }),
  allowed_term_months: Object.freeze([12, 18, 24, 36]),
  min_principal_cents: phpToCentavos(20_000),
  max_principal_cents: phpToCentavos(2_000_000),
  min_annual_income_cents: phpToCentavos(250_000),
  disbursement_rails: Object.freeze(['ACH', 'WIRE']),
})

/** @type {Readonly<Record<string, typeof PERSONAL_LOAN_PRODUCT>>} */
export const LOAN_PRODUCTS_BY_CODE = Object.freeze({
  [PERSONAL_LOAN_PRODUCT.product_code]: PERSONAL_LOAN_PRODUCT,
})

/** Sorted **term_months** values for the catalogue (PHP Personal Loan). */
export const ALL_CATALOG_TERM_MONTHS = PERSONAL_LOAN_PRODUCT.allowed_term_months

/**
 * @returns {{ products: object[], note: string }}
 */
export function buildLoanProductReferencePayload() {
  return {
    products: [{ ...PERSONAL_LOAN_PRODUCT }],
    note: '**All amounts** in **PHP centavos** on **principal_cents** / **annual_income_cents**. Principal: **PHP 20,000**–**2,000,000**. Payment preview: **GET /v1/reference/loan-computation-preview**.',
  }
}

/**
 * @param {string[]} errs
 * @param {readonly number[]} allowed
 */
function pushTermError(errs, allowed) {
  errs.push(
    'term_months must be one of approved terms for this product (months): ' + allowed.join(', '),
  )
}

/**
 * @param {unknown} body application body
 * @returns {string[]}
 */
export function validateApplicationAgainstCatalog(body) {
  const errs = []
  if (!body || typeof body !== 'object') return ['Invalid body']
  const code = body.product_code
  if (code == null || code === '') {
    errs.push('product_code required')
    return errs
  }
  const product = LOAN_PRODUCTS_BY_CODE[String(code)]
  if (!product) {
    errs.push('Unknown product_code — use GET /v1/reference/loan-products')
    return errs
  }
  if (typeof body.principal_cents !== 'number' || body.principal_cents <= 0) {
    errs.push('principal_cents must be > 0')
  } else {
    if (body.principal_cents < product.min_principal_cents) {
      errs.push(
        `principal_cents below minimum for ${product.product_code} (${product.currency} minor units): ${product.min_principal_cents}`,
      )
    }
    if (body.principal_cents > product.max_principal_cents) {
      errs.push(
        `principal_cents above maximum for ${product.product_code} (${product.currency} minor units): ${product.max_principal_cents}`,
      )
    }
  }
  const term = Number(body.term_months)
  if (typeof body.term_months !== 'number' || !product.allowed_term_months.includes(term)) {
    pushTermError(errs, product.allowed_term_months)
  }
  const b = body.borrower
  if (!b || typeof b !== 'object') errs.push('borrower required')
  else {
    if (!b.full_name) errs.push('borrower.full_name required')
    if (!b.email) errs.push('borrower.email required')
    if (typeof b.annual_income_cents !== 'number' || b.annual_income_cents < 0) {
      errs.push('borrower.annual_income_cents must be >= 0')
    } else if (
      product.min_annual_income_cents != null &&
      b.annual_income_cents < product.min_annual_income_cents
    ) {
      errs.push(
        `borrower.annual_income_cents below minimum for ${product.product_code} (${product.currency} minor units / year): ${product.min_annual_income_cents}`,
      )
    }
  }
  return errs
}
