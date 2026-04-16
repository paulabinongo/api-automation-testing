/**
 * Integration Tests for Dynamic Loan System
 * 
 * These tests verify that the refactored dynamic system works correctly
 * and maintains compatibility with existing functionality.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { unifiedLoanApi } from '../../src/api/unifiedLoanApi.js'
import { loanConfigManager } from '../../src/config/dynamicLoanConfig.js'
import { productRegistry } from '../../src/loan-products/dynamicProductRegistry.js'
import { computationEngine } from '../../src/computation/dynamicComputationSystem.js'
import { validationEngine } from '../../src/validation/unifiedValidationSystem.js'

describe('Dynamic Loan System Integration', () => {
  beforeEach(async () => {
    await unifiedLoanApi.initialize()
  })

  describe('Product Registry', () => {
    it('should initialize with default products', async () => {
      const products = await unifiedLoanApi.getProducts()
      expect(products.success).toBe(true)
      expect(products.data.length).toBeGreaterThan(0)
      
      const productCodes = products.data.map(p => p.productCode)
      expect(productCodes).toContain('HOME_LOAN')
      expect(productCodes).toContain('PERSONAL_LOAN')
    })

    it('should get product by code', async () => {
      const homeLoan = await unifiedLoanApi.getProduct('HOME_LOAN')
      expect(homeLoan.success).toBe(true)
      expect(homeLoan.data.productCode).toBe('HOME_LOAN')
      expect(homeLoan.data.productName).toBe('Metrobank Home Loan')
    })

    it('should get products by type', async () => {
      const personalProducts = await unifiedLoanApi.getProductsByType('PERSONAL')
      expect(personalProducts.success).toBe(true)
      expect(personalProducts.data.length).toBeGreaterThan(0)
      
      personalProducts.data.forEach(product => {
        expect(product.productLoanType).toBe('PERSONAL')
      })
    })
  })

  describe('Computation Engine', () => {
    it('should compute home loan preview', async () => {
      const result = await unifiedLoanApi.computeLoanPreview(
        'HOME_LOAN',
        50000000, // 500,000 PHP
        360, // 30 years
        { interestFixingYears: 5 }
      )
      
      expect(result.success).toBe(true)
      expect(result.data.productCode).toBe('HOME_LOAN')
      expect(result.data.principalCents).toBe(50000000)
      expect(result.data.termMonths).toBe(360)
      expect(result.data.monthlyPaymentCents).toBeGreaterThan(0)
      expect(result.data.effectiveInterestRate).toBeGreaterThan(0)
    })

    it('should compute personal loan preview', async () => {
      const result = await unifiedLoanApi.computeLoanPreview(
        'PERSONAL_LOAN',
        20000000, // 200,000 PHP
        36, // 3 years
        {}
      )
      
      expect(result.success).toBe(true)
      expect(result.data.productCode).toBe('PERSONAL_LOAN')
      expect(result.data.pricingModel).toBe('ADD_ON')
      expect(result.data.monthlyPaymentCents).toBeGreaterThan(0)
    })

    it('should compute multiple scenarios', async () => {
      const scenarios = [
        { termMonths: 12, name: '1 Year' },
        { termMonths: 24, name: '2 Years' },
        { termMonths: 36, name: '3 Years' }
      ]
      
      const result = await unifiedLoanApi.computeScenarios(
        'PERSONAL_LOAN',
        20000000,
        scenarios
      )
      
      expect(result.success).toBe(true)
      expect(result.data.length).toBe(3)
      
      result.data.forEach(scenario => {
        expect(scenario.success).toBe(true)
        expect(scenario.result).toBeDefined()
      })
    })

    it('should compare loan options', async () => {
      const comparisons = [
        {
          productCode: 'HOME_LOAN',
          principalCents: 50000000,
          termMonths: 360,
          options: { interestFixingYears: 5 }
        },
        {
          productCode: 'PERSONAL_LOAN',
          principalCents: 20000000,
          termMonths: 36,
          options: {}
        }
      ]
      
      const result = await unifiedLoanApi.compareLoans(comparisons)
      
      expect(result.success).toBe(true)
      expect(result.data.length).toBe(2)
      
      result.data.forEach(comparison => {
        expect(comparison.monthlyPayment).toBeGreaterThan(0)
        expect(comparison.totalInterest).toBeGreaterThanOrEqual(0)
      })
    })

    it('should calculate affordability', async () => {
      const result = await unifiedLoanApi.calculateAffordability(
        'HOME_LOAN',
        10000000, // 100,000 PHP monthly income
        0.4 // 40% DTI ratio
      )
      
      expect(result.success).toBe(true)
      expect(result.data.length).toBeGreaterThan(0)
      
      result.data.forEach(option => {
        expect(option.maxAffordablePrincipalCents).toBeGreaterThan(0)
        expect(option.monthlyPaymentCents).toBeLessThanOrEqual(4000000) // 40% of income
      })
    })
  })

  describe('Validation System', () => {
    it('should validate valid home loan application', async () => {
      const application = {
        principal_cents: 50000000,
        term_months: 360,
        loan_purpose: 'PURCHASE_HOUSE_AND_LOT',
        metrobank_client_type: 'EXISTING_CLIENT_DEPOSIT_ACCOUNT',
        borrower: {
          first_name: 'John',
          last_name: 'Doe',
          email: 'john.doe@example.com',
          mobile_phone: '+639171234567',
          date_of_birth: '1990-06-15',
          citizenship: 'FILIPINO',
          primary_id_document_type: 'DRIVERS_LICENSE',
          primary_id_document_number: 'AB123456',
          consents: {
            terms_of_use_accepted: true,
            terms_and_conditions_accepted: true,
            data_privacy_policy_accepted: true
          },
          gender: 'MALE',
          marital_status: 'SINGLE',
          education: 'COLLEGE_GRADUATE',
          place_of_birth: 'Makati',
          mailing_same_as_residential: true,
          residential_address: {
            street_line: 'Rizal Street',
            subdivision_village: 'Greenwoods Subdivision',
            province: 'NCR',
            city_town: 'Makati',
            barangay: 'San Antonio',
            postal_code: '1200',
            home_ownership: 'OWNED'
          }
        },
        employment: {
          status: 'EMPLOYED',
          source_of_funds: 'EMPLOYED',
          employment_status: 'REGULAR',
          occupation: 'OFFICE_CLERK',
          industry: 'Financial Services',
          years_working_total: 10,
          gross_monthly_income_cents: 5000000, // 50,000 PHP
          employer_name: 'Example Corp'
        }
      }
      
      const result = await unifiedLoanApi.validateApplication(application, 'HOME_LOAN')
      
      expect(result.success).toBe(true)
      expect(result.data.valid).toBe(true)
    })

    it('should reject invalid application', async () => {
      const invalidApplication = {
        principal_cents: 10000, // Too low
        term_months: 360,
        loan_purpose: 'PURCHASE_HOUSE_AND_LOT',
        borrower: {
          first_name: '', // Empty
          last_name: 'Doe',
          email: 'invalid-email', // Invalid format
          mobile_phone: '123', // Invalid phone
          date_of_birth: '2025-01-01', // Future date
          citizenship: 'INVALID', // Invalid citizenship
          primary_id_document_type: 'DRIVERS_LICENSE',
          primary_id_document_number: '123', // Invalid ID number
          consents: {
            terms_of_use_accepted: false, // Not accepted
            terms_and_conditions_accepted: false,
            data_privacy_policy_accepted: false
          }
        },
        employment: {
          status: 'EMPLOYED',
          gross_monthly_income_cents: 100000 // Too low
        }
      }
      
      const result = await unifiedLoanApi.validateApplication(invalidApplication, 'HOME_LOAN')
      
      expect(result.success).toBe(true)
      expect(result.data.valid).toBe(false)
      expect(result.data.results.borrower.valid).toBe(false)
      expect(result.data.results.loan.valid).toBe(false)
    })
  })

  describe('Configuration System', () => {
    it('should get product configuration', async () => {
      const result = await unifiedLoanApi.getProductConfig('HOME_LOAN')
      
      expect(result.success).toBe(true)
      expect(result.data.product).toBeDefined()
      expect(result.data.interestConfig).toBeDefined()
      expect(result.data.purposeConfig).toBeDefined()
      expect(result.data.feeConfig).toBeDefined()
      expect(result.data.eligibilityConfig).toBeDefined()
    })

    it('should get loan purposes', async () => {
      const result = await unifiedLoanApi.getLoanPurposes('HOME_LOAN')
      
      expect(result.success).toBe(true)
      expect(result.data.length).toBeGreaterThan(0)
      
      const purposes = result.data
      expect(purposes.some(p => p.code === 'PURCHASE_HOUSE_AND_LOT')).toBe(true)
      expect(purposes.some(p => p.code === 'PURCHASE_CONDOMINIUM')).toBe(true)
    })

    it('should get max term for purpose', async () => {
      const result = await unifiedLoanApi.getMaxTerm('HOME_LOAN', 'PURCHASE_HOUSE_AND_LOT', 'resident')
      
      expect(result.success).toBe(true)
      expect(result.data).toBe(300) // 25 years
    })

    it('should get max LTV for purpose', async () => {
      const result = await unifiedLoanApi.getMaxLtv('HOME_LOAN', 'PURCHASE_HOUSE_AND_LOT', 'primary')
      
      expect(result.success).toBe(true)
      expect(result.data).toBe(80) // 80%
    })

    it('should calculate fees', async () => {
      const result = await unifiedLoanApi.calculateFees(
        'HOME_LOAN',
        'application',
        50000000,
        { location: 'metro_manila' }
      )
      
      expect(result.success).toBe(true)
      expect(result.data.totalFeesCents).toBeGreaterThan(0)
      expect(result.data.breakdown).toBeDefined()
    })

    it('should get interest rate', async () => {
      const result = await unifiedLoanApi.getInterestRate('HOME_LOAN', 5, false)
      
      expect(result.success).toBe(true)
      expect(result.data).toBe(8.25) // 5-year rate
    })

    it('should check eligibility', async () => {
      const applicantData = {
        age: 30,
        grossMonthlyIncomeCents: 5000000, // 50,000 PHP
        employment: {
          yearsWithCurrentEmployer: 5
        }
      }
      
      const loanData = {
        principal_cents: 50000000,
        term_months: 360
      }
      
      const result = await unifiedLoanApi.checkEligibility('HOME_LOAN', applicantData, loanData)
      
      expect(result.success).toBe(true)
      expect(result.data.eligible).toBe(true)
    })
  })

  describe('Dynamic Updates', () => {
    it('should add new product', async () => {
      const newProductConfig = {
        productCode: 'TEST_LOAN',
        productName: 'Test Loan Product',
        productLoanType: 'PERSONAL',
        loanType: 'test',
        minPrincipalCents: 10000000,
        maxPrincipalCents: 100000000,
        minTermMonths: 12,
        maxTermMonths: 48,
        allowedTermMonths: [12, 24, 36, 48],
        interestRateModel: 'LEVEL_ANNUAL_PERCENT_BY_LOCK_IN_BUCKET',
        rateBuckets: [
          { years: 1, rate: 10.0 },
          { years: 2, rate: 11.0 }
        ],
        maxLtvPercent: 70,
        requiresCollateral: false,
        minAge: 21,
        maxAge: 60,
        minGrossMonthlyIncomeCents: 2000000,
        purposes: [
          {
            code: 'TEST_PURPOSE',
            label: 'Test Purpose',
            maxTermMonthsResident: 36,
            maxLtvPercent: 70
          }
        ],
        fees: {
          application: [
            {
              name: 'Test Fee',
              amount: 100000,
              type: 'fixed'
            }
          ]
        },
        eligibilityCriteria: {
          minAge: 21,
          minGrossMonthlyIncomeCents: 2000000
        }
      }
      
      const addResult = await unifiedLoanApi.addProduct(newProductConfig)
      expect(addResult.success).toBe(true)
      
      const getResult = await unifiedLoanApi.getProduct('TEST_LOAN')
      expect(getResult.success).toBe(true)
      expect(getResult.data.productCode).toBe('TEST_LOAN')
      
      const removeResult = await unifiedLoanApi.removeProduct('TEST_LOAN')
      expect(removeResult.success).toBe(true)
    })

    it('should update existing product', async () => {
      const originalProduct = await unifiedLoanApi.getProduct('PERSONAL_LOAN')
      expect(originalProduct.success).toBe(true)
      
      const updateResult = await unifiedLoanApi.updateProduct('PERSONAL_LOAN', {
        maxPrincipalCents: 300000000 // Update from 2M to 3M
      })
      expect(updateResult.success).toBe(true)
      
      const updatedProduct = await unifiedLoanApi.getProduct('PERSONAL_LOAN')
      expect(updatedProduct.success).toBe(true)
      expect(updatedProduct.data.maxPrincipalCents).toBe(300000000)
      
      // Restore original value
      await unifiedLoanApi.updateProduct('PERSONAL_LOAN', {
        maxPrincipalCents: originalProduct.data.maxPrincipalCents
      })
    })
  })

  describe('System Status', () => {
    it('should get system status', async () => {
      const result = await unifiedLoanApi.getSystemStatus()
      
      expect(result.success).toBe(true)
      expect(result.data.initialized).toBe(true)
      expect(result.data.totalProducts).toBeGreaterThan(0)
      expect(result.data.productTypes.length).toBeGreaterThan(0)
      expect(result.data.loanTypes.length).toBeGreaterThan(0)
      expect(result.data.availableProducts.length).toBeGreaterThan(0)
    })
  })

  describe('Backward Compatibility', () => {
    it('should maintain compatibility with existing imports', async () => {
      // Test that legacy imports still work
      const { HOME_LOAN_PRODUCT } = await import('../../src/loan-products/types/home-loan/homeLoanCatalog.js')
      expect(HOME_LOAN_PRODUCT).toBeDefined()
      expect(HOME_LOAN_PRODUCT.product_code).toBe('HOME_LOAN')
    })

    it('should support existing function signatures', async () => {
      // Test that existing computation functions still work
      const { computeLoanPreviewForProduct } = await import('../../src/loan-products/calculations/computationRegistry.js')
      
      const result = computeLoanPreviewForProduct('HOME_LOAN', 50000000, 360, {
        interestFixingYears: 5
      })
      
      expect(result).toBeDefined()
      expect(result.productCode).toBe('HOME_LOAN')
    })
  })
})
