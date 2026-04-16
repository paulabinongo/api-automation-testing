/**
 * Unified Loan API Interface
 * 
 * This interface consolidates all loan-related operations into a single, dynamic API
 * that can handle different loan products, validations, computations, and configurations.
 */

import { productRegistry } from '../loan-products/dynamicProductRegistry.js'
import { computationEngine } from '../computation/dynamicComputationSystem.js'
import { validationEngine } from '../validation/unifiedValidationSystem.js'
import { loanConfigManager } from '../config/dynamicLoanConfig.js'

/**
 * Unified Loan API class
 */
export class UnifiedLoanApi {
  constructor() {
    this.initialized = false
  }

  /**
   * Initialize the API
   */
  async initialize() {
    if (this.initialized) return
    
    await productRegistry.initialize()
    this.initialized = true
  }

  /**
   * Get all loan products
   */
  async getProducts() {
    await this.initialize()
    return productRegistry.getAllProducts()
  }

  /**
   * Get product by code
   */
  async getProduct(productCode) {
    await this.initialize()
    return productRegistry.getProduct(productCode)
  }

  /**
   * Get products by type
   */
  async getProductsByType(productLoanType) {
    await this.initialize()
    return productRegistry.getProductsByType(productLoanType)
  }

  /**
   * Compute loan preview
   */
  async computeLoanPreview(productCode, principalCents, termMonths, options = {}) {
    await this.initialize()
    
    try {
      const result = computationEngine.computePreview(productCode, principalCents, termMonths, options)
      return {
        success: true,
        data: result
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Compute multiple scenarios
   */
  async computeScenarios(productCode, principalCents, scenarios) {
    await this.initialize()
    
    try {
      const results = computationEngine.computeScenarios(productCode, principalCents, scenarios)
      return {
        success: true,
        data: results
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Compare loan options
   */
  async compareLoans(comparisons) {
    await this.initialize()
    
    try {
      const results = computationEngine.compareLoans(comparisons)
      return {
        success: true,
        data: results
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Calculate affordability
   */
  async calculateAffordability(productCode, monthlyIncomeCents, maxDebtToIncomeRatio = 0.4) {
    await this.initialize()
    
    try {
      const results = computationEngine.calculateAffordability(productCode, monthlyIncomeCents, maxDebtToIncomeRatio)
      return {
        success: true,
        data: results
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Validate loan application
   */
  async validateApplication(application, productCode) {
    await this.initialize()
    
    try {
      const result = validationEngine.validateLoanApplication(application, productCode)
      return {
        success: true,
        data: result
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Get product configuration
   */
  async getProductConfig(productCode) {
    await this.initialize()
    
    const product = loanConfigManager.getProduct(productCode)
    if (!product) {
      return {
        success: false,
        error: `Product ${productCode} not found`
      }
    }

    const config = {
      product: product,
      interestConfig: loanConfigManager.getInterestConfig(productCode),
      purposeConfig: loanConfigManager.getPurposeConfig(productCode),
      feeConfig: loanConfigManager.getFeeConfig(productCode),
      eligibilityConfig: loanConfigManager.getEligibilityConfig(productCode)
    }

    return {
      success: true,
      data: config
    }
  }

  /**
   * Update product configuration
   */
  async updateProductConfig(productCode, updates) {
    await this.initialize()
    
    try {
      loanConfigManager.updateProduct(productCode, updates)
      return {
        success: true,
        message: `Product ${productCode} updated successfully`
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Add new product
   */
  async addProduct(productConfig) {
    await this.initialize()
    
    try {
      productRegistry.addProduct(productConfig)
      return {
        success: true,
        message: `Product ${productConfig.productCode} added successfully`
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Remove product
   */
  async removeProduct(productCode) {
    await this.initialize()
    
    try {
      productRegistry.removeProduct(productCode)
      return {
        success: true,
        message: `Product ${productCode} removed successfully`
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Get loan purposes for product
   */
  async getLoanPurposes(productCode) {
    await this.initialize()
    
    const purposeConfig = loanConfigManager.getPurposeConfig(productCode)
    if (!purposeConfig) {
      return {
        success: false,
        error: `Purpose configuration not found for product ${productCode}`
      }
    }

    return {
      success: true,
      data: purposeConfig.getAllPurposes()
    }
  }

  /**
   * Get max term for purpose and borrower type
   */
  async getMaxTerm(productCode, purposeCode, borrowerType = 'resident', collateralType = 'standard') {
    await this.initialize()
    
    const purposeConfig = loanConfigManager.getPurposeConfig(productCode)
    if (!purposeConfig) {
      return {
        success: false,
        error: `Purpose configuration not found for product ${productCode}`
      }
    }

    const maxTerm = purposeConfig.getMaxTerm(purposeCode, borrowerType, collateralType)
    return {
      success: true,
      data: maxTerm
    }
  }

  /**
   * Get max LTV for purpose
   */
  async getMaxLtv(productCode, purposeCode, ltvType = 'primary') {
    await this.initialize()
    
    const purposeConfig = loanConfigManager.getPurposeConfig(productCode)
    if (!purposeConfig) {
      return {
        success: false,
        error: `Purpose configuration not found for product ${productCode}`
      }
    }

    const maxLtv = purposeConfig.getMaxLtv(purposeCode, ltvType)
    return {
      success: true,
      data: maxLtv
    }
  }

  /**
   * Calculate fees for product
   */
  async calculateFees(productCode, feeType, principalCents = 0, additionalParams = {}) {
    await this.initialize()
    
    const feeConfig = loanConfigManager.getFeeConfig(productCode)
    if (!feeConfig) {
      return {
        success: false,
        error: `Fee configuration not found for product ${productCode}`
      }
    }

    const totalFees = feeConfig.calculateTotalFees(feeType, principalCents, additionalParams)
    const feeBreakdown = feeConfig.getFeesByType(feeType)

    return {
      success: true,
      data: {
        totalFeesCents: totalFees,
        breakdown: feeBreakdown
      }
    }
  }

  /**
   * Check eligibility
   */
  async checkEligibility(productCode, applicantData, loanData) {
    await this.initialize()
    
    const eligibilityConfig = loanConfigManager.getEligibilityConfig(productCode)
    if (!eligibilityConfig) {
      return {
        success: false,
        error: `Eligibility configuration not found for product ${productCode}`
      }
    }

    const result = eligibilityConfig.checkEligibility(applicantData, loanData)
    return {
      success: true,
      data: result
    }
  }

  /**
   * Get interest rate
   */
  async getInterestRate(productCode, lockInYears, isHomeEquity = false) {
    await this.initialize()
    
    const interestConfig = loanConfigManager.getInterestConfig(productCode)
    if (!interestConfig) {
      return {
        success: false,
        error: `Interest configuration not found for product ${productCode}`
      }
    }

    const rate = interestConfig.getRate(lockInYears, isHomeEquity)
    return {
      success: true,
      data: rate
    }
  }

  /**
   * Get system status
   */
  async getSystemStatus() {
    await this.initialize()
    
    const products = productRegistry.getAllProducts()
    const systemInfo = {
      initialized: this.initialized,
      totalProducts: products.length,
      productTypes: [...new Set(products.map(p => p.productLoanType))],
      loanTypes: [...new Set(products.map(p => p.loanType))],
      availableProducts: products.map(p => ({
        code: p.productCode,
        name: p.productName,
        type: p.loanType
      }))
    }

    return {
      success: true,
      data: systemInfo
    }
  }
}

// Global API instance
export const unifiedLoanApi = new UnifiedLoanApi()

/**
 * Convenience functions for common operations
 */
export const loanApi = {
  // Product operations
  getProducts: () => unifiedLoanApi.getProducts(),
  getProduct: (code) => unifiedLoanApi.getProduct(code),
  getProductsByType: (type) => unifiedLoanApi.getProductsByType(type),
  
  // Computation operations
  computeLoanPreview: (code, principal, term, options) => 
    unifiedLoanApi.computeLoanPreview(code, principal, term, options),
  computeScenarios: (code, principal, scenarios) => 
    unifiedLoanApi.computeScenarios(code, principal, scenarios),
  compareLoans: (comparisons) => unifiedLoanApi.compareLoans(comparisons),
  calculateAffordability: (code, income, ratio) => 
    unifiedLoanApi.calculateAffordability(code, income, ratio),
  
  // Validation operations
  validateApplication: (application, code) => 
    unifiedLoanApi.validateApplication(application, code),
  checkEligibility: (code, applicant, loan) => 
    unifiedLoanApi.checkEligibility(code, applicant, loan),
  
  // Configuration operations
  getProductConfig: (code) => unifiedLoanApi.getProductConfig(code),
  getLoanPurposes: (code) => unifiedLoanApi.getLoanPurposes(code),
  getMaxTerm: (code, purpose, borrower, collateral) => 
    unifiedLoanApi.getMaxTerm(code, purpose, borrower, collateral),
  getMaxLtv: (code, purpose, ltvType) => unifiedLoanApi.getMaxLtv(code, purpose, ltvType),
  calculateFees: (code, feeType, principal, params) => 
    unifiedLoanApi.calculateFees(code, feeType, principal, params),
  getInterestRate: (code, years, isHomeEquity) => 
    unifiedLoanApi.getInterestRate(code, years, isHomeEquity),
  
  // System operations
  getSystemStatus: () => unifiedLoanApi.getSystemStatus(),
  addProduct: (config) => unifiedLoanApi.addProduct(config),
  updateProduct: (code, updates) => unifiedLoanApi.updateProductConfig(code, updates),
  removeProduct: (code) => unifiedLoanApi.removeProduct(code)
}
