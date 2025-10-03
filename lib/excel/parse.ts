import fs from 'fs'
import path from 'path'
import * as XLSX from 'xlsx'
import { PRODUCT_FILES, type ProductType } from './files'

export type SheetIndexItem = {
  id: string
  name: string
  type: ProductType
  records: number
  lastModified: string
}

export type SheetData = {
  columns: string[]
  rows: Array<Record<string, any>>
  records: number
}

const hasValue = (v: any) => v !== undefined && v !== null && String(v).trim() !== ''

function getWorkbookPath(type: ProductType) {
  const rel = PRODUCT_FILES[type]
  const abs = path.resolve(process.cwd(), rel)
  return abs
}

export function loadWorkbook(type: ProductType): { wb: XLSX.WorkBook; mtimeISO: string } {
  const abs = getWorkbookPath(type)
  const buf = fs.readFileSync(abs)
  const stat = fs.statSync(abs)
  const wb = XLSX.read(buf, { type: 'buffer' })
  const mtimeISO = new Date(stat.mtimeMs).toISOString().slice(0, 10)
  return { wb, mtimeISO }
}

export function listSheets(type: ProductType): { names: string[]; mtimeISO: string } {
  const { wb, mtimeISO } = loadWorkbook(type)
  return { names: wb.SheetNames, mtimeISO }
}

export function detectColumns(ws: XLSX.WorkSheet): { columns: string[]; lastCol: number } {
  // Determine used range and extend by +3 columns
  const ref = (ws as any)["!ref"] as string | undefined
  const range = XLSX.utils.decode_range(ref ?? 'A1:A1')
  const lastCol = Math.max(1, range.e.c + 1 + 3)
  const columns: string[] = []
  for (let c = 0; c < lastCol; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c })
    const v = (ws as any)[addr]?.v
    columns.push(hasValue(v) ? String(v) : `Column ${c + 1}`)
  }
  return { columns, lastCol }
}

export function readRows(
  ws: XLSX.WorkSheet,
  columns: string[],
  lastCol: number,
): { rows: Array<Record<string, any>>; records: number } {
  const ref = (ws as any)["!ref"] as string | undefined
  const range = XLSX.utils.decode_range(ref ?? 'A1:A1')
  const endRow = Math.max(1, range.e.r + 1 + 3)
  const endCol = lastCol

  const rows: Array<Record<string, any>> = []

  // Calculate records as count of rows (excluding header row) that have any value
  let records = 0
  for (let r = 1; r < endRow; r++) {
    const obj: Record<string, any> = {}
    let hasAny = false
    for (let c = 0; c < endCol; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      const cell = (ws as any)[addr]
      const v = cell?.v
      if (!hasAny && hasValue(v) && r - 1 <= range.e.r && c <= range.e.c) {
        hasAny = true
      }
      obj[columns[c]] = hasValue(v) ? v : '-'
    }
    if (hasAny) records++
    rows.push(obj)
  }
  return { rows, records }
}

export function sheetToData(type: ProductType, sheet: string): SheetData {
  const { wb } = loadWorkbook(type)
  if (!wb.SheetNames.includes(sheet)) throw new Error('Sheet not found')
  const ws = wb.Sheets[sheet]
  const { columns, lastCol } = detectColumns(ws)
  const { rows, records } = readRows(ws, columns, lastCol)
  return { columns, rows, records }
}

export function indexForType(type: ProductType): SheetIndexItem[] {
  const abs = getWorkbookPath(type)
  const { wb, mtimeISO } = loadWorkbook(type)
  const items: SheetIndexItem[] = []
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name]
    const { columns, lastCol } = detectColumns(ws)
    const { records } = readRows(ws, columns, lastCol)
    items.push({ id: `${type}:${name}`, name, type, records, lastModified: mtimeISO })
  }
  return items
}
