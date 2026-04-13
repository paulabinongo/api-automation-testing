/**
 * Template — copy to **`../<product-slug>/`** and rename.
 * Wire **`computeNewProductPreview`** → **`../computationRegistry.js`** (**`COMPUTATION_BY_PRODUCT_CODE`**)
 * when **GET …/loan-computation-preview** should work for this product.
 *
 * Return **`null`** if **term_months** is out of range or preview is not supported.
 */

/**
 * @param {number} principalCents
 * @param {number} termMonths
 * @param {object} [options] — product-specific options (e.g. home loan **loan_purpose**)
 * @returns {object | null} preview payload or **null** if unsupported
 */
export function computeNewProductPreview(principalCents, termMonths, options = {}) {
  void principalCents
  void termMonths
  void options
  return null
}
