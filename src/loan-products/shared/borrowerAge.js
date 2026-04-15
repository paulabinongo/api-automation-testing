/**
 * Shared borrower age helpers for eligibility (personal / home loan).
 */

/**
 * @param {string} ymd `YYYY-MM-DD`
 * @param {Date} onDate
 * @returns {number} whole years of age on **onDate**
 */
export function ageOnDate(ymd, onDate) {
  const p = String(ymd).split('-').map(Number)
  if (p.length !== 3 || p.some((n) => Number.isNaN(n))) return NaN
  const [y, m, d] = p
  const birth = new Date(y, m - 1, d)
  let age = onDate.getFullYear() - birth.getFullYear()
  const md = onDate.getMonth() - birth.getMonth()
  if (md < 0 || (md === 0 && onDate.getDate() < birth.getDate())) age--
  return age
}

/** @param {Date} d @param {number} months */
export function addCalendarMonths(d, months) {
  const x = new Date(d.getTime())
  x.setMonth(x.getMonth() + months)
  return x
}
