/**
 * Metrobank-style occupation LOV for **PERSONAL_LOAN** intake (**employment.occupation** must be one of **value**).
 * Labels mirror common origination pickers; codes are stable API enums.
 */
export const PERSONAL_LOAN_OCCUPATIONS = Object.freeze([
  Object.freeze({ value: 'JUNIOR_MANAGEMENT', label: 'Junior Management' }),
  Object.freeze({ value: 'SELF_EMPLOYED_PROPRIETOR', label: 'Self Employed / Proprietor' }),
  Object.freeze({ value: 'SENIOR_MANAGEMENT', label: 'Senior Management' }),
  Object.freeze({ value: 'OFFICE_CLERK', label: 'Office Clerk' }),
  Object.freeze({
    value: 'ACCOUNT_PAYROLL_CLERK_BOOKKEEPER',
    label: 'Account / Payroll Clerk / Bookkeeper',
  }),
  Object.freeze({ value: 'AFFILIATED_SALES_PERSONNEL', label: 'Affiliated Sales Personnel' }),
  Object.freeze({ value: 'BANK_TELLER_CASHIER', label: 'Bank Teller / Cashier' }),
  Object.freeze({ value: 'CALL_CENTER_AGENT_COLLECTOR', label: 'Call Center Agent / Collector' }),
  Object.freeze({ value: 'CHEF', label: 'Chef' }),
  Object.freeze({ value: 'COMPUTER_PROGRAMMER', label: 'Computer Programmer' }),
  Object.freeze({
    value: 'CUSTOMER_SERVICE_CUSTOMER_CONSULTANT',
    label: 'Customer Service / Customer Consultant',
  }),
  Object.freeze({ value: 'DATA_ENTRY', label: 'Data Entry' }),
  Object.freeze({ value: 'DENTIST', label: 'Dentist' }),
  Object.freeze({ value: 'DRIVER_COURIER_MESSENGER', label: 'Driver / Courier / Messenger' }),
  Object.freeze({ value: 'ELECTRICIAN_MECHANIC', label: 'Electrician / Mechanic' }),
  Object.freeze({ value: 'ENTERTAINER_JOURNALIST', label: 'Entertainer / Journalist' }),
  Object.freeze({ value: 'FARM_OWNER_MANAGER', label: 'Farm Owner / Manager' }),
  Object.freeze({ value: 'FARM_WORKER', label: 'Farm Worker' }),
  Object.freeze({ value: 'GOVERNMENT_PUBLIC_PERSONALITY', label: 'Government Public Personality' }),
  Object.freeze({
    value: 'HAIR_DRESSER_BEAUTICIAN_TAILOR',
    label: 'Hair Dresser / Beautician / Tailor',
  }),
  Object.freeze({ value: 'HOUSEWIFE', label: 'Housewife' }),
  Object.freeze({ value: 'STUDENT', label: 'Student' }),
  Object.freeze({ value: 'JUDGE', label: 'Judge' }),
  Object.freeze({ value: 'MACHINE_OPERATOR', label: 'Machine Operator' }),
  Object.freeze({ value: 'MEDICAL_ASSISTANT', label: 'Medical Assistant' }),
  Object.freeze({
    value: 'MILITARY_POLICE_JUNIOR_OFFICER',
    label: 'Military / Police - Junior Officer',
  }),
  Object.freeze({
    value: 'MILITARY_POLICE_SENIOR_OFFICER',
    label: 'Military / Police - Senior Officer',
  }),
  Object.freeze({
    value: 'MISCELLANEOUS_SELLERS_AND_VENDOR',
    label: 'Miscellaneous Sellers & Vendor',
  }),
  Object.freeze({
    value: 'NON_AFFILIATED_SALES_PERSONNEL',
    label: 'Non-affiliated Sales Personnel',
  }),
  Object.freeze({ value: 'OTHER_CLERICAL_WORKS', label: 'Other Clerical Works' }),
  Object.freeze({ value: 'OTHER_GOVERNMENT_PROFESSIONAL', label: 'Other Government Professional' }),
  Object.freeze({ value: 'OTHER_PRIVATE_PROFESSIONAL', label: 'Other Private Professional' }),
  Object.freeze({ value: 'OTHER_SALES', label: 'Other Sales' }),
  Object.freeze({
    value: 'OTHER_SERVICE_WORKERS_UPSCALE',
    label: 'Other Service Workers - Upscale',
  }),
  Object.freeze({ value: 'OTHER_SERVICE_WORKERS', label: 'Other Service Workers' }),
  Object.freeze({ value: 'OTHER_TECHNICAL', label: 'Other Technical' }),
  Object.freeze({ value: 'OTHER_WORKERS', label: 'Other Workers' }),
  Object.freeze({
    value: 'OTHER_SPECIALIST_TEACHERS_LIBRARIAN',
    label: 'Other / Specialist Teachers / Librarian',
  }),
  Object.freeze({ value: 'OTHERS', label: 'Others' }),
  Object.freeze({ value: 'PILOT', label: 'Pilot' }),
  Object.freeze({ value: 'POLICE_SECURITY', label: 'Police / Security' }),
  Object.freeze({ value: 'PRESIDENT', label: 'President' }),
  Object.freeze({ value: 'PRIVATE_SCHOOL_TEACHER', label: 'Private School Teacher' }),
  Object.freeze({
    value: 'PRODUCTION_CONSTRUCTION_SUPERVISOR',
    label: 'Production / Construction Supervisor',
  }),
  Object.freeze({
    value: 'PRODUCTION_CONSTRUCTION_WORKER',
    label: 'Production / Construction Worker',
  }),
  Object.freeze({ value: 'PUBLIC_SCHOOL_TEACHER', label: 'Public School Teacher' }),
  Object.freeze({ value: 'RECEPTIONIST_SECRETARY', label: 'Receptionist / Secretary' }),
  Object.freeze({ value: 'RELIGIOUS_CLERGY', label: 'Religious / Clergy' }),
  Object.freeze({ value: 'RESEARCH_ANALYST', label: 'Research / Analyst' }),
  Object.freeze({ value: 'RETIRED_PENSIONER', label: 'Retired / Pensioner' }),
  Object.freeze({ value: 'SALES_ASSISTANT_SALES_REP', label: 'Sales Assistant / Sales Rep' }),
  Object.freeze({ value: 'SEAMAN_OFW', label: 'Seaman / OFW' }),
  Object.freeze({ value: 'SECURITY_GUARD_FIREMAN', label: 'Security Guard / Fireman' }),
  Object.freeze({ value: 'SUPERVISOR', label: 'Supervisor' }),
  Object.freeze({ value: 'UNEMPLOYED', label: 'Unemployed' }),
  Object.freeze({ value: 'WAITER_BARTENDER_USHER', label: 'Waiter / Bartender / Usher' }),
  Object.freeze({ value: 'MISSING', label: 'Missing' }),
  Object.freeze({ value: 'ACCOUNTANT', label: 'Accountant' }),
  Object.freeze({ value: 'ARCHITECT', label: 'Architect' }),
  Object.freeze({ value: 'CONSULTANT', label: 'Consultant' }),
  Object.freeze({ value: 'DESIGNER', label: 'Designer' }),
  Object.freeze({ value: 'DOCTOR', label: 'Doctor' }),
  Object.freeze({ value: 'ENGINEER', label: 'Engineer' }),
  Object.freeze({
    value: 'FINANCIAL_CONTROLLER_STOCK_BROKER',
    label: 'Financial Controller / Stock Broker',
  }),
  Object.freeze({ value: 'LAWYER', label: 'Lawyer' }),
  Object.freeze({ value: 'NURSE_PHARMACIST', label: 'Nurse / Pharmacist' }),
])

/** @type {ReadonlySet<string>} */
export const PERSONAL_LOAN_OCCUPATION_CODES = Object.freeze(
  new Set(PERSONAL_LOAN_OCCUPATIONS.map((r) => r.value)),
)
