import fs from 'fs'
import path from 'path'
import * as XLSX from 'xlsx'

// Mirror of lib/excel/files.ts (kept in sync)
const PRODUCT_FILES = {
  BC: 'excel-data/BS-8WW.xlsx',
  CC: 'excel-data/CC-LO7.xlsx',
  CS: 'excel-data/CS.xlsx',
}

const hasValue = (v) => v !== undefined && v !== null && String(v).trim() !== ''

function detectColumns(ws) {
  const ref = ws['!ref']
  const range = XLSX.utils.decode_range(ref ?? 'A1:A1')
  const lastCol = Math.max(1, range.e.c + 1 + 3)
  const columns = []
  for (let c = 0; c < lastCol; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c })
    const v = ws[addr]?.v
    columns.push(hasValue(v) ? String(v) : `Column ${c + 1}`)
  }
  return { columns, lastCol }
}

function readRows(ws, columns, lastCol) {
  const ref = ws['!ref']
  const range = XLSX.utils.decode_range(ref ?? 'A1:A1')
  const endRow = Math.max(1, range.e.r + 1 + 3)
  const endCol = lastCol
  const rows = []
  let records = 0
  for (let r = 1; r < endRow; r++) {
    const obj = {}
    let hasAny = false
    for (let c = 0; c < endCol; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      const cell = ws[addr]
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

function writeJSON(filePath, data) {
  const dir = path.dirname(filePath)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(data))
}

function build() {
  const outDir = path.resolve(process.cwd(), 'public/data')
  fs.mkdirSync(outDir, { recursive: true })
  for (const type of Object.keys(PRODUCT_FILES)) {
    const rel = PRODUCT_FILES[type]
    const abs = path.resolve(process.cwd(), rel)
    const stat = fs.statSync(abs)
    const mtimeISO = new Date(stat.mtimeMs).toISOString().slice(0, 10)
    const buf = fs.readFileSync(abs)
    const wb = XLSX.read(buf, { type: 'buffer' })
    const items = []
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name]
      const { columns, lastCol } = detectColumns(ws)
      const { rows, records } = readRows(ws, columns, lastCol)
      items.push({ id: `${type}:${name}`, name, type, records, lastModified: mtimeISO })
      const sheetFile = path.join(outDir, `sheet-${type}-${encodeURIComponent(name)}.json`)
      writeJSON(sheetFile, { columns, rows, records })
    }
    const indexFile = path.join(outDir, `index-${type}.json`)
    writeJSON(indexFile, items)
  }
}

build()

