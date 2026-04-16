/**
 * Dynamic Loan Product Configuration System
 * 
 * This system provides a centralized, dynamic way to configure loan products,
 * interest rates, fees, and business rules without hardcoding values.
 */

/**
 * Base configuration template for loan products
 */
export const LOAN_PRODUCT_CONFIG_TEMPLATE = {
  // Product metadata
  productCode: '',
  productName: '',
  productLoanType: '', // PERSONAL | BUSINESS
  loanType: '', // personal | home | auto | etc.
  
  // Loan terms and limits
  minPrincipalCents: 0,
  maxPrincipalCents: 0,
  minTermMonths: 0,
  maxTermMonths: 0,
  allowedTermMonths: [],
  
  // Interest rate configuration
  interestRateModel: '', // LEVEL_ANNUAL_PERCENT_BY_LOCK_IN_BUCKET | ADD_ON
  rateBuckets: [],
  
  // LTV and collateral
  maxLtvPercent: 0,
  maxLtvSecondaryPercent: 0,
  requiresCollateral: false,
  
  // Eligibility criteria
  minAge: 0,
  maxAge: 0,
  minGrossMonthlyIncomeCents: 0,
  minEmploymentTenureMonths: 0,
  minBusinessOperatingYears: 0,
  
  // Documentation requirements
  requiredDocuments: [],
  optionalDocuments: [],
  
  // Fees and charges
  fees: {
    application: [],
    processing: [],
    disbursement: [],
    postApproval: []
  },
  
  // Special conditions
  specialConditions: {
    ofwMaxTermMonths: null,
    vacantLotMaxTermMonths: null,
    homeEquityRatePremium: 0,
    requiresMetrobankDeposit: false,
    requiresPepClearance: false
  },
  
  // Lifecycle phases
  lifecyclePhases: []
}

/**
 * Dynamic interest rate configuration
 */
export class DynamicInterestRateConfig {
  constructor(rateModel, rateBuckets = []) {
    this.model = rateModel
    this.rateBuckets = rateBuckets
  }

  /**
   * Create rate buckets for level annual percent model
   */
  static createLevelAnnualRateBuckets(baseRates, homeEquityPremium = 0) {
    return baseRates.map(rate => ({
      lockInYears: rate.years,
      annualInterestPercent: rate.rate,
      homeEquityAnnualPercent: rate.rate + homeEquityPremium,
      description: `${rate.years}-year lock-in period`
    }))
  }

  /**
   * Create add-on rate configuration
   */
  static createAddOnRateConfig(termOptions) {
    return termOptions.map(term => ({
      termMonths: term.months,
      addOnRate: term.rate,
      description: `${term.months}-month term`
    }))
  }

  /**
   * Get rate for specific parameters
   */
  getRate(lockInYears, isHomeEquity = false) {
    if (this.model === 'LEVEL_ANNUAL_PERCENT_BY_LOCK_IN_BUCKET') {
      const bucket = this.rateBuckets.find(b => b.lockInYears === lockInYears)
      if (!bucket) return null
      
      return isHomeEquity ? bucket.homeEquityAnnualPercent : bucket.annualInterestPercent
    }
    
    if (this.model === 'ADD_ON') {
      // For add-on, return the rate based on term
      return this.rateBuckets.find(b => b.termMonths === lockInYears)?.addOnRate || null
    }
    
    return null
  }
}

/**
 * Dynamic loan purpose configuration
 */
export class DynamicLoanPurposeConfig {
  constructor(purposes) {
    this.purposes = new Map()
    purposes.forEach(purpose => this.addPurpose(purpose))
  }

  addPurpose(purpose) {
    this.purposes.set(purpose.code, {
      ...purpose,
      maxTermMonths: {
        resident: purpose.maxTermMonthsResident,
        ofw: purpose.maxTermMonthsOfw || purpose.maxTermMonthsResident,
        vacantLot: purpose.vacantLotMaxTermMonthsResident || purpose.maxTermMonthsResident
      },
      ltv: {
        primary: purpose.maxLtvPercent,
        secondary: purpose.maxLtvSecondaryPercent || purpose.maxLtvPercent
      }
    })
  }

  getPurpose(purposeCode) {
    return this.purposes.get(purposeCode)
  }

  getAllPurposes() {
    return Array.from(this.purposes.values())
  }

  getMaxTerm(purposeCode, borrowerType = 'resident', collateralType = 'standard') {
    const purpose = this.getPurpose(purposeCode)
    if (!purpose) return null

    switch (collateralType) {
      case 'vacantLot':
        return purpose.maxTermMonths.vacantLot
      case 'standard':
      default:
        return purpose.maxTermMonths[borrowerType]
    }
  }

  getMaxLtv(purposeCode, ltvType = 'primary') {
    const purpose = this.getPurpose(purposeCode)
    return purpose ? purpose.ltv[ltvType] : null
  }
}

/**
 * Dynamic fee configuration
 */
export class DynamicFeeConfig {
  constructor(fees) {
    this.fees = fees
  }

  getFeesByType(feeType) {
    return this.fees[feeType] || []
  }

  calculateTotalFees(feeType, principalCents = 0, additionalParams = {}) {
    const fees = this.getFeesByType(feeType)
    return fees.reduce((total, fee) => {
      let amount = fee.amount || 0
      
      // Handle percentage-based fees
      if (fee.type === 'percentage' && principalCents > 0) {
        amount = (principalCents * fee.rate) / 100
      }
      
      // Handle conditional fees
      if (fee.condition && !fee.condition(principalCents, additionalParams)) {
        return total
      }
      
      return total + amount
    }, 0)
  }
}

/**
 * Dynamic eligibility configuration
 */
export class DynamicEligibilityConfig {
  constructor(criteria) {
    this.criteria = criteria
  }

  checkEligibility(applicantData, loanData) {
    const results = {}

    // Age check
    if (this.criteria.minAge) {
      results.age = applicantData.age >= this.criteria.minAge
    }
    if (this.criteria.maxAge) {
      results.age = results.age && applicantData.age <= this.criteria.maxAge
    }

    // Income check
    if (this.criteria.minGrossMonthlyIncomeCents) {
      results.income = applicantData.grossMonthlyIncomeCents >= this.criteria.minGrossMonthlyIncomeCents
    }

    // Employment check
    if (this.criteria.minEmploymentTenureMonths && applicantData.employment) {
      results.employment = applicantData.employment.yearsWithCurrentEmployer * 12 >= this.criteria.minEmploymentTenureMonths
    }

    // Business check
    if (this.criteria.minBusinessOperatingYears && applicantData.business) {
      results.business = applicantData.business.yearsInOperation >= this.criteria.minBusinessOperatingYears
    }

    return {
      eligible: Object.values(results).every(result => result === true),
      checks: results
    }
  }
}

/**
 * Main dynamic configuration manager
 */
export class DynamicLoanConfigManager {
  constructor() {
    this.products = new Map()
    this.interestConfigs = new Map()
    this.purposeConfigs = new Map()
    this.feeConfigs = new Map()
    this.eligibilityConfigs = new Map()
  }

  /**
   * Register a loan product with dynamic configuration
   */
  registerProduct(productCode, config) {
    // Validate required fields
    this.validateProductConfig(config)
    
    // Store product configuration
    this.products.set(productCode, { ...LOAN_PRODUCT_CONFIG_TEMPLATE, ...config })
    
    // Create specialized configurations
    if (config.rateBuckets) {
      this.interestConfigs.set(productCode, new DynamicInterestRateConfig(config.interestRateModel, config.rateBuckets))
    }
    
    if (config.purposes) {
      this.purposeConfigs.set(productCode, new DynamicLoanPurposeConfig(config.purposes))
    }
    
    if (config.fees) {
      this.feeConfigs.set(productCode, new DynamicFeeConfig(config.fees))
    }
    
    if (config.eligibilityCriteria) {
      this.eligibilityConfigs.set(productCode, new DynamicEligibilityConfig(config.eligibilityCriteria))
    }
  }

  /**
   * Get product configuration
   */
  getProduct(productCode) {
    return this.products.get(productCode)
  }

  /**
   * Get interest rate configuration
   */
  getInterestConfig(productCode) {
    return this.interestConfigs.get(productCode)
  }

  /**
   * Get purpose configuration
   */
  getPurposeConfig(productCode) {
    return this.purposeConfigs.get(productCode)
  }

  /**
   * Get fee configuration
   */
  getFeeConfig(productCode) {
    return this.feeConfigs.get(productCode)
  }

  /**
   * Get eligibility configuration
   */
  getEligibilityConfig(productCode) {
    return this.eligibilityConfigs.get(productCode)
  }

  /**
   * Validate product configuration
   */
  validateProductConfig(config) {
    const required = ['productCode', 'productName', 'productLoanType', 'loanType']
    const missing = required.filter(field => !config[field])
    
    if (missing.length > 0) {
      throw new Error(`Missing required product configuration fields: ${missing.join(', ')}`)
    }
  }

  /**
   * Get all registered products
   */
  getAllProducts() {
    return Array.from(this.products.values())
  }

  /**
   * Update product configuration dynamically
   */
  updateProduct(productCode, updates) {
    const existing = this.products.get(productCode)
    if (!existing) {
      throw new Error(`Product ${productCode} not found`)
    }
    
    const updated = { ...existing, ...updates }
    this.products.set(productCode, updated)
    
    // Re-create specialized configurations if needed
    if (updates.rateBuckets) {
      this.interestConfigs.set(productCode, new DynamicInterestRateConfig(updated.interestRateModel, updated.rateBuckets))
    }
  }
}

// Global instance
export const loanConfigManager = new DynamicLoanConfigManager()
