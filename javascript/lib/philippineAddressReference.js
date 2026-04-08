/**
 * Sample Philippine **province → city/municipality → barangay → ZIP** rows for **POST /loan-applications**
 * **residential_address** triplet validation. Production systems use full PSGC; this sandbox exposes a small
 * reference set on **GET /reference/loan-products** → **philippine_address_sample_rows** for demos.
 */

/** @typedef {{ province: string, city_town: string, barangay: string, postal_code: string }} PhAddressRow */

/** @type {Readonly<PhAddressRow>[]} */
export const PH_ADDRESS_VALID_ROWS = Object.freeze([
  Object.freeze({
    province: 'NCR',
    city_town: 'Makati',
    barangay: 'San Antonio',
    postal_code: '1200',
  }),
  Object.freeze({
    province: 'NCR',
    city_town: 'Makati',
    barangay: 'Bel-Air',
    postal_code: '1209',
  }),
  Object.freeze({
    province: 'NCR',
    city_town: 'Quezon City',
    barangay: 'Diliman',
    postal_code: '1101',
  }),
  Object.freeze({
    province: 'NCR',
    city_town: 'Manila',
    barangay: 'Ermita',
    postal_code: '1000',
  }),
  Object.freeze({
    province: 'Cebu',
    city_town: 'Cebu City',
    barangay: 'Lahug',
    postal_code: '6000',
  }),
  Object.freeze({
    province: 'Cebu',
    city_town: 'Cebu City',
    barangay: 'Guadalupe',
    postal_code: '6000',
  }),
  Object.freeze({
    province: 'Davao del Sur',
    city_town: 'Davao City',
    barangay: 'Poblacion',
    postal_code: '8000',
  }),
  Object.freeze({
    province: 'Laguna',
    city_town: 'Calamba',
    barangay: 'Halang',
    postal_code: '4027',
  }),
])

/**
 * @param {unknown} province
 * @param {unknown} cityTown
 * @param {unknown} barangay
 * @param {unknown} postalCode — **ZIP** (string or number); normalized to **4** digits for comparison with reference rows
 */
export function isValidPhAddressTriplet(province, cityTown, barangay, postalCode) {
  const p = String(province ?? '').trim()
  const c = String(cityTown ?? '').trim()
  const b = String(barangay ?? '').trim()
  const z = postalCode == null ? '' : String(postalCode).trim()
  if (!/^\d{4}$/.test(z)) return false
  return PH_ADDRESS_VALID_ROWS.some(
    (r) => r.province === p && r.city_town === c && r.barangay === b && r.postal_code === z,
  )
}
