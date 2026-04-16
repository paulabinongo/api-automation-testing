/**
 * Dynamic Computation System
 * 
 * This system consolidates all loan calculation logic into a dynamic framework
 * that can handle different loan products and computation models.
 */

import { loanConfigManager } from '../config/dynamicLoanConfig.js'

/**
 * Base computation strategy interface
 */
export class ComputationStrategy {
  constructor(productCode) {
    this.productCode = productCode
  }

  /**
   * Compute loan preview - must be implemented by subclasses
   */
  computePreview(principalCents, termMonths, options = {}) {
    throw new Error('computePreview must be implemented by subclass')
  }

  /**
   * Calculate monthly payment - must be implemented by subclasses
   */
  calculateMonthlyPayment(principalCents, rate, termMonths) {
    throw new Error('calculateMonthlyPayment must be implemented by subclass')
  }

  /**
   * Calculate effective interest rate - must be implemented by subclasses
   */
  calculateEffectiveRate(netProceedsCents, monthlyPaymentCents, termMonths) {
    throw new Error('calculateEffectiveRate must be implemented by subclass')
  }
}

/**
 * Level Annual Percent Computation Strategy
 */
export class LevelAnnualPercentStrategy extends ComputationStrategy {
  computePreview(principalCents, termMonths, options = {}) {
    const product = loanConfigManager.getProduct(this.productCode)
    if (!product) {
      throw new Error(`Product ${this.productCode} not found`)
    }

    const interestConfig = loanConfigManager.getInterestConfig(this.productCode)
    const purposeConfig = loanConfigManager.getPurposeConfig(this.productCode)
    const feeConfig = loanConfigManager.getFeeConfig(this.productCode)

    // Get interest rate
    const lockInYears = options.interestFixingYears || 1
    const isHomeEquity = options.isHomeEquity || false
    const annualRate = interestConfig.getRate(lockInYears, isHomeEquity)
    
    if (annualRate === null) {
      throw new Error(`Invalid interest rate configuration for ${lockInYears} years`)
    }

    // Convert to monthly rate
    const monthlyRate = annualRate / 100 / 12

    // Calculate monthly payment using amortization formula
    const monthlyPaymentCents = this.calculateMonthlyPayment(principalCents, monthlyRate, termMonths)

    // Calculate total interest
    const totalPaymentCents = monthlyPaymentCents * termMonths
    const totalInterestCents = totalPaymentCents - principalCents

    // Calculate fees
    const applicationFees = feeConfig.calculateTotalFees('application', principalCents, options)
    const disbursementFees = feeConfig.calculateTotalFees('disbursement', principalCents, options)
    const totalFeesCents = applicationFees + disbursementFees

    // Calculate net proceeds
    const netProceedsCents = principalCents - totalFeesCents

    // Calculate effective interest rate
    const effectiveRate = this.calculateEffectiveRate(netProceedsCents, monthlyPaymentCents, termMonths)

    return {
      productCode: this.productCode,
      principalCents,
      termMonths,
      interestFixingYears: lockInYears,
      pricingModel: 'LEVEL_ANNUAL_PERCENT_BY_LOCK_IN_BUCKET',
      
      // Rate information
      annualInterestPercent: annualRate,
      monthlyRatePercent: monthlyRate * 100,
      effectiveInterestRate: effectiveRate,
      
      // Payment information
      monthlyPaymentCents,
      totalPaymentCents,
      totalInterestCents,
      
      // Fee information
      applicationFeesCents: applicationFees,
      disbursementFeesCents: disbursementFees,
      totalFeesCents,
      netProceedsCents,
      
      // Additional information
      isHomeEquity,
      purpose: options.loanPurpose,
      borrowerType: options.borrowerType || 'resident'
    }
  }

  calculateMonthlyPayment(principalCents, monthlyRate, termMonths) {
    if (monthlyRate === 0) {
      return Math.round(principalCents / termMonths)
    }
    
    const numerator = principalCents * monthlyRate * Math.pow(1 + monthlyRate, termMonths)
    const denominator = Math.pow(1 + monthlyRate, termMonths) - 1
    
    return Math.round(numerator / denominator)
  }

  calculateEffectiveRate(netProceedsCents, monthlyPaymentCents, termMonths) {
    // Newton-Raphson method to solve for monthly rate
    let r = 0.01 // Initial guess
    const tolerance = 1e-8
    const maxIterations = 100

    for (let i = 0; i < maxIterations; i++) {
      const f = this.pvOrdinaryAnnuity(r, termMonths, monthlyPaymentCents) - netProceedsCents
      const df = this.pvOrdinaryAnnuityDerivative(r, termMonths, monthlyPaymentCents)
      
      if (Math.abs(f) < tolerance) break
      
      r = r - f / df
      
      if (r < 0) r = 0.001 // Prevent negative rates
      if (r > 1) r = 0.999 // Prevent rates > 100%
    }

    // Convert monthly rate to annual effective rate
    const annualEffectiveRate = Math.pow(1 + r, 12) - 1
    return Math.round(annualEffectiveRate * 100000) / 1000 // Round to 3 decimal places
  }

  pvOrdinaryAnnuity(rate, n, payment) {
    if (rate <= 0) return payment * n
    return (payment * (1 - Math.pow(1 + rate, -n))) / rate
  }

  pvOrdinaryAnnuityDerivative(rate, n, payment) {
    if (rate <= 0) return 0
    const pow = Math.pow(1 + rate, -n)
    return payment * n * pow / (rate * (1 + rate))
  }
}

/**
 * Add-On Interest Computation Strategy
 */
export class AddOnInterestStrategy extends ComputationStrategy {
  computePreview(principalCents, termMonths, options = {}) {
    const product = loanConfigManager.getProduct(this.productCode)
    if (!product) {
      throw new Error(`Product ${this.productCode} not found`)
    }

    const interestConfig = loanConfigManager.getInterestConfig(this.productCode)
    const feeConfig = loanConfigManager.getFeeConfig(this.productCode)

    // Get add-on rate
    const addOnRate = interestConfig.getRate(termMonths)
    if (addOnRate === null) {
      throw new Error(`Invalid add-on rate configuration for ${termMonths} months`)
    }

    // Calculate total interest (add-on model)
    const principalPhp = principalCents / 100
    const totalInterestPhp = principalPhp * (addOnRate / 100) * termMonths
    const totalInterestCents = Math.round(totalInterestPhp * 100)

    // Calculate total payment and monthly amortization
    const totalPaymentCents = principalCents + totalInterestCents
    const monthlyPaymentCents = Math.round(totalPaymentCents / termMonths)

    // Calculate fees
    const applicationFees = feeConfig.calculateTotalFees('application', principalCents, options)
    const disbursementFees = feeConfig.calculateTotalFees('disbursement', principalCents, options)
    const totalFeesCents = applicationFees + disbursementFees

    // Calculate net proceeds
    const netProceedsCents = principalCents - totalFeesCents

    // Calculate effective interest rate
    const effectiveRate = this.calculateEffectiveRate(netProceedsCents, monthlyPaymentCents, termMonths)

    return {
      productCode: this.productCode,
      principalCents,
      termMonths,
      pricingModel: 'ADD_ON',
      
      // Rate information
      addOnRatePercent: addOnRate,
      effectiveInterestRate: effectiveRate,
      
      // Payment information
      monthlyPaymentCents,
      totalPaymentCents,
      totalInterestCents,
      
      // Fee information
      applicationFeesCents: applicationFees,
      disbursementFeesCents: disbursementFees,
      totalFeesCents,
      netProceedsCents,
      
      // Additional information
      purpose: options.loanPurpose,
      borrowerType: options.borrowerType || 'resident'
    }
  }

  calculateMonthlyPayment(principalCents, rate, termMonths) {
    // For add-on model, monthly payment is calculated differently
    const principalPhp = principalCents / 100
    const totalInterestPhp = principalPhp * (rate / 100) * termMonths
    const totalPaymentPhp = principalPhp + totalInterestPhp
    return Math.round((totalPaymentPhp * 100) / termMonths)
  }

  calculateEffectiveRate(netProceedsCents, monthlyPaymentCents, termMonths) {
    // Newton-Raphson method for EIR calculation
    let r = 0.01
    const tolerance = 1e-8
    const maxIterations = 100

    for (let i = 0; i < maxIterations; i++) {
      const f = this.pvOrdinaryAnnuity(r, termMonths, monthlyPaymentCents) - netProceedsCents
      const df = this.pvOrdinaryAnnuityDerivative(r, termMonths, monthlyPaymentCents)
      
      if (Math.abs(f) < tolerance) break
      
      r = r - f / df
      
      if (r < 0) r = 0.001
      if (r > 1) r = 0.999
    }

    const annualEffectiveRate = Math.pow(1 + r, 12) - 1
    return Math.round(annualEffectiveRate * 100000) / 1000
  }

  pvOrdinaryAnnuity(rate, n, payment) {
    if (rate <= 0) return payment * n
    return (payment * (1 - Math.pow(1 + rate, -n))) / rate
  }

  pvOrdinaryAnnuityDerivative(rate, n, payment) {
    if (rate <= 0) return 0
    const pow = Math.pow(1 + rate, -n)
    return payment * n * pow / (rate * (1 + rate))
  }
}

/**
 * Dynamic Computation Engine
 */
export class DynamicComputationEngine {
  constructor() {
    this.strategies = new Map()
    this.initializeStrategies()
  }

  /**
   * Initialize computation strategies
   */
  initializeStrategies() {
    // Register default strategies
    this.registerStrategy('LEVEL_ANNUAL_PERCENT_BY_LOCK_IN_BUCKET', LevelAnnualPercentStrategy)
    this.registerStrategy('ADD_ON', AddOnInterestStrategy)
  }

  /**
   * Register computation strategy
   */
  registerStrategy(modelType, strategyClass) {
    this.strategies.set(modelType, strategyClass)
  }

  /**
   * Get computation strategy for product
   */
  getStrategy(productCode) {
    const product = loanConfigManager.getProduct(productCode)
    if (!product) {
      throw new Error(`Product ${productCode} not found`)
    }

    const StrategyClass = this.strategies.get(product.interestRateModel)
    if (!StrategyClass) {
      throw new Error(`No strategy found for model: ${product.interestRateModel}`)
    }

    return new StrategyClass(productCode)
  }

  /**
   * Compute loan preview
   */
  computePreview(productCode, principalCents, termMonths, options = {}) {
    const strategy = this.getStrategy(productCode)
    return strategy.computePreview(principalCents, termMonths, options)
  }

  /**
   * Compute multiple scenarios
   */
  computeScenarios(productCode, principalCents, scenarios) {
    const results = []
    
    for (const scenario of scenarios) {
      try {
        const result = this.computePreview(productCode, principalCents, scenario.termMonths, scenario)
        results.push({
          scenario: scenario.name || `Term ${scenario.termMonths} months`,
          success: true,
          result
        })
      } catch (error) {
        results.push({
          scenario: scenario.name || `Term ${scenario.termMonths} months`,
          success: false,
          error: error.message
        })
      }
    }

    return results
  }

  /**
   * Compare loan options
   */
  compareLoans(comparisons) {
    const results = []
    
    for (const comparison of comparisons) {
      try {
        const result = this.computePreview(
          comparison.productCode,
          comparison.principalCents,
          comparison.termMonths,
          comparison.options || {}
        )
        
        results.push({
          productCode: comparison.productCode,
          termMonths: comparison.termMonths,
          principalCents: comparison.principalCents,
          monthlyPayment: result.monthlyPaymentCents,
          totalInterest: result.totalInterestCents,
          effectiveRate: result.effectiveInterestRate,
          netProceeds: result.netProceedsCents,
          totalFees: result.totalFeesCents
        })
      } catch (error) {
        results.push({
          productCode: comparison.productCode,
          termMonths: comparison.termMonths,
          error: error.message
        })
      }
    }

    return results
  }

  /**
   * Calculate affordability
   */
  calculateAffordability(productCode, monthlyIncomeCents, maxDebtToIncomeRatio = 0.4) {
    const product = loanConfigManager.getProduct(productCode)
    if (!product) {
      throw new Error(`Product ${productCode} not found`)
    }

    const maxMonthlyPaymentCents = Math.round(monthlyIncomeCents * maxDebtToIncomeRatio)
    const results = []

    // Test different terms to find affordable options
    for (const termMonths of product.allowedTermMonths) {
      try {
        const preview = this.computePreview(productCode, product.maxPrincipalCents, termMonths)
        
        if (preview.monthlyPaymentCents <= maxMonthlyPaymentCents) {
          // Find maximum affordable principal
          let maxPrincipal = product.maxPrincipalCents
          let minPrincipal = product.minPrincipalCents
          let affordablePrincipal = 0

          // Binary search for maximum affordable principal
          for (let i = 0; i < 20; i++) {
            const midPrincipal = Math.round((minPrincipal + maxPrincipal) / 2)
            const testPreview = this.computePreview(productCode, midPrincipal, termMonths)
            
            if (testPreview.monthlyPaymentCents <= maxMonthlyPaymentCents) {
              affordablePrincipal = midPrincipal
              minPrincipal = midPrincipal
            } else {
              maxPrincipal = midPrincipal
            }
          }

          results.push({
            termMonths,
            maxAffordablePrincipalCents: affordablePrincipal,
            monthlyPaymentCents: this.computePreview(productCode, affordablePrincipal, termMonths).monthlyPaymentCents,
            debtToIncomeRatio: (this.computePreview(productCode, affordablePrincipal, termMonths).monthlyPaymentCents / monthlyIncomeCents)
          })
        }
      } catch (error) {
        // Skip invalid scenarios
        continue
      }
    }

    return results.sort((a, b) => b.maxAffordablePrincipalCents - a.maxAffordablePrincipalCents)
  }
}

// Global computation engine instance
export const computationEngine = new DynamicComputationEngine()
