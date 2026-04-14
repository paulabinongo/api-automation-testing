/**
 * Sample Philippine **region → province → city/municipality → barangay → ZIP** rows for **POST /loan-applications**
 * **residential_address** validation. Production systems use full PSGC; this sandbox exposes a small
 * reference set on **GET /reference/loan-products** → **philippine_address_sample_rows** for demos.
 *
 * **HOME_LOAN (Metrobank form):** **`region`** is the official label (e.g. **Region VIII - Eastern Visayas**);
 * **`province`**, **`city_town`**, **`barangay`**, **`postal_code`** must match the same row together with **`region`**.
 */

/** @typedef {{ region: string, province: string, city_town: string, barangay: string, postal_code: string }} PhAddressRow */

/** @type {Readonly<PhAddressRow>[]} */
export const PH_ADDRESS_VALID_ROWS = Object.freeze([
  Object.freeze({
    region: 'National Capital Region (NCR)',
    province: 'NCR',
    city_town: 'Makati',
    barangay: 'San Antonio',
    postal_code: '1200',
  }),
  Object.freeze({
    region: 'National Capital Region (NCR)',
    province: 'NCR',
    city_town: 'Makati',
    barangay: 'Bel-Air',
    postal_code: '1209',
  }),
  Object.freeze({
    region: 'National Capital Region (NCR)',
    province: 'NCR',
    city_town: 'Quezon City',
    barangay: 'Diliman',
    postal_code: '1101',
  }),
  Object.freeze({
    region: 'National Capital Region (NCR)',
    province: 'NCR',
    city_town: 'Manila',
    barangay: 'Ermita',
    postal_code: '1000',
  }),
  Object.freeze({
    region: 'Region VII - Central Visayas',
    province: 'Cebu',
    city_town: 'Cebu City',
    barangay: 'Lahug',
    postal_code: '6000',
  }),
  Object.freeze({
    region: 'Region VII - Central Visayas',
    province: 'Cebu',
    city_town: 'Cebu City',
    barangay: 'Guadalupe',
    postal_code: '6000',
  }),
  Object.freeze({
    region: 'Region XI - Davao Region',
    province: 'Davao del Sur',
    city_town: 'Davao City',
    barangay: 'Poblacion',
    postal_code: '8000',
  }),
  Object.freeze({
    region: 'Region IV-A - CALABARZON',
    province: 'Laguna',
    city_town: 'Calamba',
    barangay: 'Halang',
    postal_code: '4027',
  }),
  Object.freeze({
    region: 'Region VIII - Eastern Visayas',
    province: 'Leyte',
    city_town: 'Tacloban City',
    barangay: 'Marasbaras',
    postal_code: '6500',
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

/**
 * **HOME_LOAN** — **region** + geographic line must match one reference row (Metrobank **Region** + Province / City / Barangay / ZIP).
 *
 * @param {unknown} region
 * @param {unknown} province
 * @param {unknown} cityTown
 * @param {unknown} barangay
 * @param {unknown} postalCode
 */
export function isValidPhAddressRow(region, province, cityTown, barangay, postalCode) {
  const reg = String(region ?? '').trim()
  const p = String(province ?? '').trim()
  const c = String(cityTown ?? '').trim()
  const b = String(barangay ?? '').trim()
  const z = postalCode == null ? '' : String(postalCode).trim()
  if (!/^\d{4}$/.test(z)) return false
  return PH_ADDRESS_VALID_ROWS.some(
    (row) =>
      row.region === reg &&
      row.province === p &&
      row.city_town === c &&
      row.barangay === b &&
      row.postal_code === z,
  )
}
