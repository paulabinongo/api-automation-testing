/**
 * Dynamic Loan Product Registry
 * 
 * This registry replaces static product definitions with a dynamic system
 * that can be configured at runtime and easily extended.
 */

import { loanConfigManager } from '../config/dynamicLoanConfig.js'

/**
 * Dynamic product registry class
 */
export class DynamicProductRegistry {
  constructor() {
    this.initialized = false
    this.products = new Map()
  }

  /**
   * Initialize the registry with default products
   */
  async initialize() {
    if (this.initialized) return

    // Register Home Loan product
    await this.registerHomeLoan()
    
    // Register Personal Loan product
    await this.registerPersonalLoan()
    
    // Register Auto Loan product (if available)
    await this.registerAutoLoan()

    this.initialized = true
  }

  /**
   * Register Home Loan product with dynamic configuration
   */
  async registerHomeLoan() {
    const homeLoanConfig = {
      productCode: 'HOME_LOAN',
      productName: 'Metrobank Home Loan',
      productLoanType: 'PERSONAL',
      loanType: 'home',
      
      minPrincipalCents: 50000000, // 500,000 PHP
      maxPrincipalCents: 500000000, // 5,000,000 PHP
      minTermMonths: 12,
      maxTermMonths: 300, // 25 years
      allowedTermMonths: [12, 24, 36, 48, 60, 72, 84, 96, 108, 120, 132, 144, 156, 168, 180, 192, 204, 216, 228, 240, 252, 264, 276, 288, 300],
      
      interestRateModel: 'LEVEL_ANNUAL_PERCENT_BY_LOCK_IN_BUCKET',
      rateBuckets: [
        { years: 1, rate: 6.25 },
        { years: 2, rate: 7.25 },
        { years: 3, rate: 7.75 },
        { years: 4, rate: 8.0 },
        { years: 5, rate: 8.25 }
      ],
      
      maxLtvPercent: 80,
      maxLtvSecondaryPercent: 75,
      requiresCollateral: true,
      
      minAge: 21,
      maxAge: 65,
      minGrossMonthlyIncomeCents: 4000000, // 40,000 PHP
      minEmploymentTenureMonths: 24, // 2 years
      minBusinessOperatingYears: 36, // 3 years
      
      purposes: [
        {
          code: 'PURCHASE_HOUSE_AND_LOT',
          label: 'Purchase of House and Lot',
          maxTermMonthsResident: 300,
          maxTermMonthsOfw: 180,
          maxLtvPercent: 80,
          maxLtvSecondaryPercent: 75
        },
        {
          code: 'PURCHASE_TOWNHOUSE',
          label: 'Purchase of Townhouse',
          maxTermMonthsResident: 300,
          maxTermMonthsOfw: 180,
          maxLtvPercent: 80,
          maxLtvSecondaryPercent: 75
        },
        {
          code: 'PURCHASE_CONDOMINIUM',
          label: 'Purchase of Condominium',
          maxTermMonthsResident: 300,
          maxTermMonthsOfw: 180,
          maxLtvPercent: 70,
          maxLtvSecondaryPercent: 75
        },
        {
          code: 'PURCHASE_VACANT_LOT',
          label: 'Purchase of Vacant Lot',
          maxTermMonthsResident: 120,
          maxTermMonthsOfw: 120,
          maxLtvPercent: 60,
          maxLtvSecondaryPercent: 75
        },
        {
          code: 'PURCHASE_LOT_AND_HOUSE_CONSTRUCTION',
          label: 'Purchase of Lot and House Construction',
          maxTermMonthsResident: 300,
          maxTermMonthsOfw: 180,
          maxLtvPercent: 80,
          maxLtvSecondaryPercent: 75
        },
        {
          code: 'HOUSE_CONSTRUCTION_OWNED_LOT',
          label: 'House Construction on Owned Lot',
          maxTermMonthsResident: 300,
          maxTermMonthsOfw: 180,
          maxLtvPercent: 80,
          maxLtvSecondaryPercent: 75
        },
        {
          code: 'REIMBURSEMENT',
          label: 'Reimbursement',
          maxTermMonthsResident: 300,
          maxTermMonthsOfw: 180,
          maxLtvPercent: 80,
          maxLtvSecondaryPercent: 75,
          vacantLotMaxTermMonthsResident: 120,
          vacantLotMaxTermMonthsOfw: 120
        },
        {
          code: 'RENOVATION_EXPANSION',
          label: 'Renovation / Expansion',
          maxTermMonthsResident: 240,
          maxTermMonthsOfw: 180,
          maxLtvPercent: 80,
          maxLtvSecondaryPercent: 75
        },
        {
          code: 'REFINANCING_LOAN_TAKEOUT',
          label: 'Refinancing / Loan Take-out',
          maxTermMonthsResident: 180,
          maxTermMonthsOfw: 180,
          maxLtvPercent: 70,
          maxLtvSecondaryPercent: 60,
          vacantLotMaxTermMonthsResident: 120,
          vacantLotMaxTermMonthsOfw: 120
        },
        {
          code: 'HOME_EQUITY_PERSONAL_CONSUMPTION',
          label: 'Home Equity / Personal Consumption',
          maxTermMonthsResident: 60,
          maxTermMonthsOfw: 180,
          maxLtvPercent: 60,
          maxLtvSecondaryPercent: 60,
          usesHomeEquityRateTier: true,
          homeEquityImprovementMaxTermMonths: 120
        },
        {
          code: 'PERSONAL_INVESTMENT_RESIDENTIAL_ASSET',
          label: 'Personal Investment - Residential Asset Acquisition',
          maxTermMonthsResident: 300,
          maxTermMonthsOfw: 180,
          maxLtvPercent: 80,
          maxLtvSecondaryPercent: 75,
          vacantCollateralMaxTermMonthsResident: 120,
          vacantCollateralMaxTermMonthsOfw: 120
        }
      ],
      
      fees: {
        application: [
          {
            name: 'Appraisal Fee - Metro Manila',
            amount: 400000, // 4,000 PHP in cents
            type: 'fixed',
            condition: (principal, params) => params.location === 'metro_manila'
          },
          {
            name: 'Appraisal Fee - Countryside',
            amount: 450000, // 4,500 PHP in cents
            type: 'fixed',
            condition: (principal, params) => params.location !== 'metro_manila'
          },
          {
            name: 'Title Investigation Fee',
            amount: 100000, // 1,000 PHP in cents
            type: 'per_title'
          }
        ],
        processing: [
          {
            name: 'Handling Fee',
            amount: 500000, // 5,000 PHP in cents
            type: 'fixed'
          },
          {
            name: 'Notarial Fee',
            amount: 40000, // 400 PHP in cents
            type: 'per_document'
          }
        ],
        disbursement: [
          {
            name: 'Documentary Stamp Tax',
            rate: 0.75,
            type: 'percentage',
            condition: (principal) => principal > 25000000 // 250,000 PHP
          }
        ]
      },
      
      eligibilityCriteria: {
        minAge: 21,
        maxAge: 65,
        minGrossMonthlyIncomeCents: 4000000, // 40,000 PHP
        minEmploymentTenureMonths: 24,
        minBusinessOperatingYears: 36
      },
      
      specialConditions: {
        ofwMaxTermMonths: 180, // 15 years
        vacantLotMaxTermMonths: 120, // 10 years
        homeEquityRatePremium: 1.0, // +1% for home equity
        requiresMetrobankDeposit: true,
        requiresPepClearance: true
      },
      
      lifecyclePhases: [
        { phase: 1, title: 'Eligibility & Pre-Qualification' },
        { phase: 2, title: 'Documentation Complete' },
        { phase: 3, title: 'Underwriting Review' },
        { phase: 4, title: 'Credit Evaluation' },
        { phase: 5, title: 'Approval & Booking' },
        { phase: 6, title: 'Loan Maturity & Closing' }
      ]
    }

    loanConfigManager.registerProduct('HOME_LOAN', homeLoanConfig)
  }

  /**
   * Register Personal Loan product with dynamic configuration
   */
  async registerPersonalLoan() {
    const personalLoanConfig = {
      productCode: 'PERSONAL_LOAN',
      productName: 'Metrobank Personal Loan',
      productLoanType: 'PERSONAL',
      loanType: 'personal',
      
      minPrincipalCents: 20000000, // 200,000 PHP
      maxPrincipalCents: 200000000, // 2,000,000 PHP
      minTermMonths: 12,
      maxTermMonths: 60, // 5 years
      allowedTermMonths: [12, 18, 24, 36, 48, 60],
      
      interestRateModel: 'ADD_ON',
      rateBuckets: [
        { months: 12, rate: 1.75 },
        { months: 18, rate: 1.75 },
        { months: 24, rate: 1.5 },
        { months: 36, rate: 1.5 }
      ],
      
      maxLtvPercent: 0, // Unsecured loan
      requiresCollateral: false,
      
      minAge: 21,
      maxAge: 60,
      minGrossMonthlyIncomeCents: 1500000, // 15,000 PHP
      minEmploymentTenureMonths: 12, // 1 year
      
      purposes: [
        {
          code: 'PERSONAL_CONSUMPTION',
          label: 'Personal Consumption',
          maxTermMonthsResident: 60,
          maxLtvPercent: 0
        },
        {
          code: 'DEBT_CONSOLIDATION',
          label: 'Debt Consolidation',
          maxTermMonthsResident: 48,
          maxLtvPercent: 0
        },
        {
          code: 'HOME_IMPROVEMENT',
          label: 'Home Improvement',
          maxTermMonthsResident: 36,
          maxLtvPercent: 0
        }
      ],
      
      fees: {
        application: [
          {
            name: 'Processing Fee',
            amount: 150000, // 1,500 PHP in cents
            type: 'fixed'
          }
        ],
        disbursement: [
          {
            name: 'Documentary Stamp Tax',
            rate: 0.75,
            type: 'percentage',
            condition: (principal) => principal > 25000000 // 250,000 PHP
          },
          {
            name: 'Disbursement Fee',
            amount: 150000, // 1,500 PHP in cents
            type: 'fixed'
          }
        ]
      },
      
      eligibilityCriteria: {
        minAge: 21,
        maxAge: 60,
        minGrossMonthlyIncomeCents: 1500000, // 15,000 PHP
        minEmploymentTenureMonths: 12
      },
      
      specialConditions: {
        requiresMetrobankDeposit: true,
        requiresPepClearance: true
      },
      
      lifecyclePhases: [
        { phase: 1, title: 'Application Intake' },
        { phase: 2, title: 'Documentation Review' },
        { phase: 3, title: 'Credit Evaluation' },
        { phase: 4, title: 'Approval Decision' }
      ]
    }

    loanConfigManager.registerProduct('PERSONAL_LOAN', personalLoanConfig)
  }

  /**
   * Register Auto Loan product with dynamic configuration
   */
  async registerAutoLoan() {
    const autoLoanConfig = {
      productCode: 'AUTO_LOAN',
      productName: 'Metrobank Auto Loan',
      productLoanType: 'PERSONAL',
      loanType: 'auto',
      
      minPrincipalCents: 30000000, // 300,000 PHP
      maxPrincipalCents: 300000000, // 3,000,000 PHP
      minTermMonths: 12,
      maxTermMonths: 72, // 6 years
      allowedTermMonths: [12, 18, 24, 36, 48, 60, 72],
      
      interestRateModel: 'LEVEL_ANNUAL_PERCENT_BY_LOCK_IN_BUCKET',
      rateBuckets: [
        { years: 1, rate: 7.5 },
        { years: 2, rate: 8.0 },
        { years: 3, rate: 8.5 },
        { years: 4, rate: 9.0 },
        { years: 5, rate: 9.5 }
      ],
      
      maxLtvPercent: 80,
      requiresCollateral: true,
      
      minAge: 21,
      maxAge: 65,
      minGrossMonthlyIncomeCents: 3000000, // 30,000 PHP
      minEmploymentTenureMonths: 12, // 1 year
      
      purposes: [
        {
          code: 'PURCHASE_NEW_VEHICLE',
          label: 'Purchase New Vehicle',
          maxTermMonthsResident: 72,
          maxLtvPercent: 80
        },
        {
          code: 'PURCHASE_USED_VEHICLE',
          label: 'Purchase Used Vehicle',
          maxTermMonthsResident: 60,
          maxLtvPercent: 70
        },
        {
          code: 'REFINANCING',
          label: 'Auto Loan Refinancing',
          maxTermMonthsResident: 48,
          maxLtvPercent: 75
        }
      ],
      
      fees: {
        application: [
          {
            name: 'Processing Fee',
            amount: 200000, // 2,000 PHP in cents
            type: 'fixed'
          }
        ],
        disbursement: [
          {
            name: 'Documentary Stamp Tax',
            rate: 0.75,
            type: 'percentage',
            condition: (principal) => principal > 25000000 // 250,000 PHP
          }
        ]
      },
      
      eligibilityCriteria: {
        minAge: 21,
        maxAge: 65,
        minGrossMonthlyIncomeCents: 3000000, // 30,000 PHP
        minEmploymentTenureMonths: 12
      },
      
      specialConditions: {
        requiresVehicleInsurance: true,
        requiresComprehensiveInsurance: true
      }
    }

    loanConfigManager.registerProduct('AUTO_LOAN', autoLoanConfig)
  }

  /**
   * Get product by code
   */
  getProduct(productCode) {
    return loanConfigManager.getProduct(productCode)
  }

  /**
   * Get all products
   */
  getAllProducts() {
    return loanConfigManager.getAllProducts()
  }

  /**
   * Get products by type
   */
  getProductsByType(productLoanType) {
    return this.getAllProducts().filter(product => product.productLoanType === productLoanType)
  }

  /**
   * Get products by loan type
   */
  getProductsByLoanType(loanType) {
    return this.getAllProducts().filter(product => product.loanType === loanType)
  }

  /**
   * Check if product exists
   */
  hasProduct(productCode) {
    return loanConfigManager.products.has(productCode)
  }

  /**
   * Add new product dynamically
   */
  addProduct(config) {
    loanConfigManager.registerProduct(config.productCode, config)
  }

  /**
   * Update existing product
   */
  updateProduct(productCode, updates) {
    loanConfigManager.updateProduct(productCode, updates)
  }

  /**
   * Remove product
   */
  removeProduct(productCode) {
    loanConfigManager.products.delete(productCode)
    loanConfigManager.interestConfigs.delete(productCode)
    loanConfigManager.purposeConfigs.delete(productCode)
    loanConfigManager.feeConfigs.delete(productCode)
    loanConfigManager.eligibilityConfigs.delete(productCode)
  }
}

// Global instance
export const productRegistry = new DynamicProductRegistry()

// Auto-initialize when module is imported
productRegistry.initialize().catch(console.error)
