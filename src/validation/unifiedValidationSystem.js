/**
 * Unified Validation System
 * 
 * This system consolidates all validation logic into a single, dynamic framework
 * that can be configured for different loan products and validation rules.
 */

import { loanConfigManager } from '../config/dynamicLoanConfig.js'
import { productRegistry } from '../loan-products/dynamicProductRegistry.js'

/**
 * Base validation rule class
 */
export class ValidationRule {
  constructor(name, validator, message, required = true) {
    this.name = name
    this.validator = validator
    this.message = message
    this.required = required
  }

  validate(value, context = {}) {
    try {
      const result = this.validator(value, context)
      return {
        valid: result,
        message: result ? null : this.message,
        rule: this.name
      }
    } catch (error) {
      return {
        valid: false,
        message: `Validation error: ${error.message}`,
        rule: this.name
      }
    }
  }
}

/**
 * Dynamic validation engine
 */
export class DynamicValidationEngine {
  constructor() {
    this.rules = new Map()
    this.productRules = new Map()
    this.initializeDefaultRules()
  }

  /**
   * Initialize default validation rules
   */
  initializeDefaultRules() {
    // String validations
    this.addRule('name', this.createNameValidator(), 'Name must contain only letters and spaces, 1-40 characters', false)
    this.addRule('email', this.createEmailValidator(), 'Invalid email address', false)
    this.addRule('phone', this.createPhoneValidator(), 'Invalid Philippine mobile number format', false)
    this.addRule('address', this.createAddressValidator(), 'Address must be searchable and within Philippines', false)
    
    // Numeric validations
    this.addRule('age', this.createAgeValidator(), 'Age must be between 21 and 65 years', false)
    this.addRule('income', this.createIncomeValidator(), 'Income must meet minimum requirements', false)
    this.addRule('amount', this.createAmountValidator(), 'Amount must be within allowed range', false)
    
    // Date validations
    this.addRule('date', this.createDateValidator(), 'Invalid date format', false)
    this.addRule('futureDate', this.createFutureDateValidator(), 'Date must be in the future', false)
    
    // Document validations
    this.addRule('idNumber', this.createIdNumberValidator(), 'Invalid ID number format', false)
    this.addRule('requiredDocument', this.createRequiredDocumentValidator(), 'Required document is missing', false)
    
    // Required field validators
    this.addRule('required', this.createRequiredValidator(), 'This field is required', true)
    this.addRule('requiredString', this.createRequiredStringValidator(), 'This field is required', true)
    this.addRule('requiredNumber', this.createRequiredNumberValidator(), 'This field is required', true)
  }

  /**
   * Add validation rule
   */
  addRule(name, validator, message) {
    this.rules.set(name, validator)
  }

  /**
   * Add product-specific validation rules
   */
  addProductRules(productCode, rules) {
    this.productRules.set(productCode, rules)
  }

  /**
   * Validate field with specific rule
   */
  validateField(ruleName, value, context = {}) {
    const rule = this.rules.get(ruleName)
    if (!rule) {
      return { valid: false, message: `Unknown validation rule: ${ruleName}` }
    }
    return rule.validate(value, context)
  }

  /**
   * Validate object against multiple rules
   */
  validateObject(obj, ruleMap, context = {}) {
    const results = {}
    const allValid = []

    for (const [field, ruleNames] of Object.entries(ruleMap)) {
      const fieldRules = Array.isArray(ruleNames) ? ruleNames : [ruleNames]
      const fieldResults = []

      for (const ruleName of fieldRules) {
        const rule = this.rules.get(ruleName)
        const value = obj[field]
        
        if (value !== undefined && value !== null && value !== '') {
          const result = this.validateField(ruleName, value, { ...context, field })
          fieldResults.push(result)
          allValid.push(result.valid)
        } else if (rule && rule.required) {
          fieldResults.push({
            valid: false,
            message: `${field} is required`,
            rule: ruleName
          })
          allValid.push(false)
        }
      }

      results[field] = fieldResults
    }

    return {
      valid: allValid.every(valid => valid === true),
      results
    }
  }

  /**
   * Validate loan application
   */
  validateLoanApplication(application, productCode) {
    const product = loanConfigManager.getProduct(productCode)
    if (!product) {
      return {
        valid: false,
        message: `Unknown product: ${productCode}`
      }
    }

    const context = { product, application }
    const validationResults = {}

    // Validate borrower information
    if (application.borrower) {
      validationResults.borrower = this.validateObject(application.borrower, {
        first_name: ['requiredString', 'name'],
        last_name: ['requiredString', 'name'],
        email: ['requiredString', 'email'],
        mobile_phone: ['requiredString', 'phone'],
        date_of_birth: ['requiredString', 'date'],
        citizenship: ['requiredString'],
        primary_id_document_type: ['requiredString'],
        primary_id_document_number: ['requiredString', 'idNumber'],
        gender: ['requiredString'],
        marital_status: ['requiredString'],
        education: ['requiredString'],
        place_of_birth: ['requiredString', 'name'],
        residential_address: ['required']
      }, context)
    }

    // Validate employment information
    if (application.employment) {
      validationResults.employment = this.validateObject(application.employment, {
        status: ['requiredString'],
        source_of_funds: ['requiredString'],
        employment_status: ['requiredString'],
        occupation: ['requiredString'],
        industry: ['requiredString'],
        years_working_total: ['requiredNumber'],
        gross_monthly_income_cents: ['requiredNumber', 'income'],
        employer_name: ['requiredString']
      }, context)
    }

    // Validate loan details
    validationResults.loan = this.validateObject(application, {
      principal_cents: ['requiredNumber', 'amount'],
      term_months: ['requiredNumber'],
      loan_purpose: ['requiredString'],
      metrobank_client_type: ['requiredString']
    }, context)

    // Validate eligibility
    const eligibilityConfig = loanConfigManager.getEligibilityConfig(productCode)
    if (eligibilityConfig) {
      validationResults.eligibility = eligibilityConfig.checkEligibility(
        {
          age: this.calculateAge(application.borrower?.date_of_birth),
          grossMonthlyIncomeCents: application.employment?.gross_monthly_income_cents,
          employment: application.employment,
          business: application.business
        },
        application
      )
    }

    // Product-specific validations
    const productRules = this.productRules.get(productCode)
    if (productRules) {
      validationResults.productSpecific = this.validateObject(application, productRules, context)
    }

    // Overall validation result
    const allResults = [
      validationResults.borrower?.valid ?? true,
      validationResults.employment?.valid ?? true,
      validationResults.loan?.valid ?? true,
      validationResults.eligibility?.eligible ?? true,
      validationResults.productSpecific?.valid ?? true
    ]

    return {
      valid: allResults.every(valid => valid === true),
      results: validationResults
    }
  }

  /**
   * Create name validator
   */
  createNameValidator() {
    return new ValidationRule(
      'name',
      (value) => {
        if (typeof value !== 'string') return false
        const trimmed = value.trim()
        return trimmed.length >= 1 && 
               trimmed.length <= 40 && 
               /^[a-zA-Z\s]+$/.test(trimmed)
      },
      'Name must contain only letters and spaces, 1-40 characters'
    )
  }

  /**
   * Create email validator
   */
  createEmailValidator() {
    return new ValidationRule(
      'email',
      (value) => {
        if (typeof value !== 'string') return false
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return emailRegex.test(value)
      },
      'Invalid email address'
    )
  }

  /**
   * Create phone validator
   */
  createPhoneValidator() {
    return new ValidationRule(
      'phone',
      (value) => {
        if (typeof value !== 'string') return false
        const phoneRegex = /^(\+639|09|9)\d{9}$/
        return phoneRegex.test(value.replace(/[\s-]/g, ''))
      },
      'Invalid Philippine mobile number format'
    )
  }

  /**
   * Create address validator
   */
  createAddressValidator() {
    return new ValidationRule(
      'address',
      (value) => {
        if (!value || typeof value !== 'object') return false
        const required = ['street_line', 'province', 'city_town', 'barangay', 'postal_code']
        return required.every(field => value[field] && typeof value[field] === 'string' && value[field].trim().length > 0)
      },
      'Complete address information required'
    )
  }

  /**
   * Create age validator
   */
  createAgeValidator() {
    return new ValidationRule(
      'age',
      (value, context) => {
        const product = context.product
        if (!product) return false
        return value >= product.minAge && value <= product.maxAge
      },
      'Age must meet product requirements'
    )
  }

  /**
   * Create income validator
   */
  createIncomeValidator() {
    return new ValidationRule(
      'income',
      (value, context) => {
        const product = context.product
        if (!product) return false
        return value >= product.minGrossMonthlyIncomeCents
      },
      'Income must meet minimum requirements'
    )
  }

  /**
   * Create amount validator
   */
  createAmountValidator() {
    return new ValidationRule(
      'amount',
      (value, context) => {
        const product = context.product
        if (!product) return false
        return value >= product.minPrincipalCents && value <= product.maxPrincipalCents
      },
      'Amount must be within allowed range'
    )
  }

  /**
   * Create date validator
   */
  createDateValidator() {
    return new ValidationRule(
      'date',
      (value) => {
        if (typeof value !== 'string') return false
        const date = new Date(value)
        return !isNaN(date.getTime()) && value.match(/^\d{4}-\d{2}-\d{2}$/)
      },
      'Invalid date format (YYYY-MM-DD)'
    )
  }

  /**
   * Create future date validator
   */
  createFutureDateValidator() {
    return new ValidationRule(
      'futureDate',
      (value) => {
        const date = new Date(value)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        return date > today
      },
      'Date must be in the future'
    )
  }

  /**
   * Create ID number validator
   */
  createIdNumberValidator() {
    return new ValidationRule(
      'idNumber',
      (value, context) => {
        const idType = context.primary_id_document_type
        if (!idType || typeof value !== 'string') return false

        const validators = {
          'PASSPORT': /^[A-Z0-9]{6,9}$/,
          'DRIVERS_LICENSE': /^[A-Z]{2}\d{6}$/,
          'UMID': /^\d{12}$/,
          'SSS': /^\d{10}$/,
          'GSIS': /^\d{12}$/,
          'PHILHEALTH': /^\d{12}$/,
          'PAGIBIG': /^\d{12}$/,
          'VOTERS_ID': /^[A-Z]{4}\d{7}$/,
          'SENIOR_CITIZEN_ID': /^\d{12}$/,
          'PWD_ID': /^\d{12}$/,
          'POSTAL_ID': /^\d{4}-\d{4}-\d{4}$/,
          'OFW_ID': /^\d{10}$/,
          'SEAMANS_BOOK': /^[A-Z0-9]{8,12}$/
        }

        const validator = validators[idType]
        return validator ? validator.test(value) : /^[A-Z0-9]{6,40}$/.test(value)
      },
      'Invalid ID number format for selected ID type'
    )
  }

  /**
   * Create required document validator
   */
  createRequiredDocumentValidator() {
    return new ValidationRule(
      'requiredDocument',
      (value, context) => {
        return value && value.length > 0
      },
      'Required document is missing'
    )
  }

  /**
   * Calculate age from birth date
   */
  calculateAge(dateOfBirth) {
    if (!dateOfBirth) return null
    
    const birth = new Date(dateOfBirth)
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    
    return age
  }

  /**
   * Create required validator
   */
  createRequiredValidator() {
    return new ValidationRule(
      'required',
      (value) => value !== undefined && value !== null && value !== '',
      'This field is required'
    )
  }

  /**
   * Create required string validator
   */
  createRequiredStringValidator() {
    return new ValidationRule(
      'requiredString',
      (value) => typeof value === 'string' && value.trim().length > 0,
      'This field is required'
    )
  }

  /**
   * Create required number validator
   */
  createRequiredNumberValidator() {
    return new ValidationRule(
      'requiredNumber',
      (value) => typeof value === 'number' && !isNaN(value) && value > 0,
      'This field is required'
    )
  }
}

/**
 * Validation result formatter
 */
export class ValidationFormatter {
  /**
   * Format validation results for API response
   */
  static formatForApi(validationResult) {
    if (!validationResult.valid) {
      const errors = []
      
      Object.entries(validationResult.results).forEach(([category, result]) => {
        if (result.valid === false) {
          errors.push(`${category}: ${result.message || 'Validation failed'}`)
        } else if (Array.isArray(result)) {
          result.forEach(item => {
            if (!item.valid) {
              errors.push(`${category}: ${item.message}`)
            }
          })
        } else if (result.eligible === false) {
          errors.push('Eligibility requirements not met')
        }
      })
      
      return {
        valid: false,
        errors,
        details: validationResult.results
      }
    }
    
    return {
      valid: true,
      message: 'Validation successful'
    }
  }

  /**
   * Format validation results for UI display
   */
  static formatForUI(validationResult) {
    const formatted = {
      isValid: validationResult.valid,
      sections: []
    }

    Object.entries(validationResult.results).forEach(([section, result]) => {
      const sectionResult = {
        name: section,
        valid: result.valid !== false && (result.eligible !== false),
        errors: []
      }

      if (Array.isArray(result)) {
        result.forEach(item => {
          if (!item.valid) {
            sectionResult.errors.push(item.message)
          }
        })
      } else if (result.eligible === false) {
        sectionResult.errors.push('Eligibility requirements not met')
        if (result.checks) {
          Object.entries(result.checks).forEach(([check, passed]) => {
            if (!passed) {
              sectionResult.errors.push(`${check} requirement not met`)
            }
          })
        }
      }

      formatted.sections.push(sectionResult)
    })

    return formatted
  }
}

// Global validation engine instance
export const validationEngine = new DynamicValidationEngine()
