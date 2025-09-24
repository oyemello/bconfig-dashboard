export type ProductType = 'BC' | 'CC' | 'CS'

// Map products to Excel file paths within the repo
export const PRODUCT_FILES: Record<ProductType, string> = {
  BC: 'excel-data/BS-8WW.xlsx', // Business Checking
  CC: 'excel-data/CC-LO7.xlsx', // Consumer Checking
  CS: 'excel-data/CS.xlsx',     // Consumer Savings
}

export const PRODUCT_LABELS: Record<ProductType, string> = {
  BC: 'Business Checking',
  CC: 'Consumer Checking',
  CS: 'Consumer Savings',
}

