"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Search, Moon, Sun, Menu, Database } from "lucide-react"
import { cn } from "@/lib/utils"
type ProductType = "BC" | "CC" | "CS"

const typeLabels: Record<ProductType, string> = {
  BC: "Business Checking",
  CC: "Consumer Checking",
  CS: "Consumer Savings",
}

type IndexItem = {
  id: string
  name: string
  type: ProductType
  lastModified: string
  records: number
}

type SheetData = {
  columns: string[]
  rows: Array<Record<string, any>>
  records: number
}

export default function Dashboard() {
  const [selectedProduct, setSelectedProduct] = useState<ProductType>("BC")
  const [indexItems, setIndexItems] = useState<IndexItem[]>([])
  const [selectedItem, setSelectedItem] = useState<IndexItem | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [isDark, setIsDark] = useState(false)
  const [selectedRows, setSelectedRows] = useState<number[]>([])

  // Cache of sheet data per product+sheet
  const sheetCache = useRef<Record<string, SheetData>>({})

  const isPages = process.env.NEXT_PUBLIC_PAGES === '1'

  // Fetch index when product changes
  useEffect(() => {
    async function load() {
      setIndexItems([])
      setSelectedItem(null)
      setSelectedRows([])
      setSearchQuery("")
      const url = isPages
        ? `data/index-${selectedProduct}.json`
        : `/api/index?type=${selectedProduct}`
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) return
      const items: IndexItem[] = await res.json()
      setIndexItems(items)
      if (items.length) setSelectedItem(items[0])
    }
    load()
  }, [selectedProduct])

  // Preload all sheet contents for search if not yet loaded and query typed
  useEffect(() => {
    async function preloadAll() {
      if (!searchQuery.trim()) return
      const items = indexItems
      await Promise.all(
        items.map(async (it) => {
          const key = `${it.type}:${it.name}`
          if (sheetCache.current[key]) return
          const url = isPages
            ? `data/sheet-${it.type}-${encodeURIComponent(it.name)}.json`
            : `/api/sheet?type=${it.type}&sheet=${encodeURIComponent(it.name)}`
          const res = await fetch(url, { cache: 'no-store' })
          if (!res.ok) return
          const data: SheetData = await res.json()
          sheetCache.current[key] = data
        }),
      )
    }
    preloadAll()
  }, [searchQuery, indexItems])

  // Load selected sheet data if not cached
  useEffect(() => {
    async function loadSelected() {
      if (!selectedItem) return
      setSelectedRows([])
      const key = `${selectedItem.type}:${selectedItem.name}`
      if (sheetCache.current[key]) return
      const url = isPages
        ? `data/sheet-${selectedItem.type}-${encodeURIComponent(selectedItem.name)}.json`
        : `/api/sheet?type=${selectedItem.type}&sheet=${encodeURIComponent(selectedItem.name)}`
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) return
      const data: SheetData = await res.json()
      sheetCache.current[key] = data
      // Trigger re-render
      setIndexItems((prev) => [...prev])
    }
    loadSelected()
  }, [selectedItem])

  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return indexItems
    return indexItems.filter((it) => {
      if (it.name.toLowerCase().includes(q)) return true
      const key = `${it.type}:${it.name}`
      const data = sheetCache.current[key]
      if (!data) return false
      // Search across all cells
      for (const row of data.rows) {
        for (const val of Object.values(row)) {
          if (val !== null && val !== undefined && String(val).toLowerCase().includes(q)) return true
        }
      }
      return false
    })
  }, [indexItems, searchQuery])

  const toggleRow = (i: number) =>
    setSelectedRows((prev) => (prev.includes(i) ? prev.filter((n) => n !== i) : [...prev, i]))

  const clearAll = () => setSelectedRows([])

  const getAccentColor = (type: ProductType) => {
    switch (type) {
      case "BC":
        return "text-bc-accent border-bc-accent bg-bc-accent/10"
      case "CC":
        return "text-cc-accent border-cc-accent bg-cc-accent/10"
      case "CS":
        return "text-bs-accent border-bs-accent bg-bs-accent/10"
    }
  }

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('theme') : null
      const prefersDark = typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
        : false
      const dark = stored ? stored === 'dark' : prefersDark
      setIsDark(dark)
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', dark)
      }
    } catch {}
  }, [])

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', next)
      }
      try {
        localStorage.setItem('theme', next ? 'dark' : 'light')
      } catch {}
      return next
    })
  }

  const IndexPanel = ({ className }: { className?: string }) => (
    <div className={cn("bg-card border-r border-border flex h-full min-h-0 flex-col overflow-hidden", className)}>
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-0">
          <Database className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            {typeLabels[selectedProduct]}: {filteredItems.length} sheets
          </span>
        </div>
        {/* No type toggle buttons here */}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden no-scrollbar">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            onClick={() => setSelectedItem(item)}
            className={cn(
              "p-3 min-h-[44px] border-b border-border cursor-pointer transition-colors flex items-center justify-between",
              selectedItem?.id === item.id
                ? "bg-[#006fcf] text-white"
                : "hover:bg-accent/50",
            )}
          >
            <span className="text-sm font-medium text-balance truncate min-w-0 pr-2">{item.name}</span>
            <span className={cn("text-xs shrink-0", selectedItem?.id === item.id ? "text-white" : "text-muted-foreground")}>{item.records} records</span>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className={cn("h-screen bg-background overflow-hidden flex flex-col")}> 
      {/* Header */}
      <header className="border-b border-border bg-card/50"> 
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <img src="/AXP_700x700.svg" alt="AMEX logo" className="w-8 h-8 object-contain" />
              <span className="font-semibold text-lg">AMEX Banking Config</span>
            </div>
            {/* Sheet title and last edited info */}
            {selectedItem && (
              <div className="flex items-center gap-3 ml-6">
                
                {/* Days ago label */}
                <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground border border-border font-medium">
                  {(() => {
                    const last = new Date(selectedItem.lastModified)
                    const now = new Date()
                    const diff = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
                    return `${diff === 0 ? 'Edited today' : diff === 1 ? 'Edited 1 day ago' : `Edited ${diff} days ago`} (${last.toLocaleDateString()})`
                  })()}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Theme Toggle (replacing workbook selector) */}
            <Button aria-label="Toggle theme" variant="ghost" size="icon" onClick={toggleTheme}>
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            {/* Product Dropdown */}
            <Select value={selectedProduct} onValueChange={(value: ProductType) => setSelectedProduct(value)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BC">{typeLabels.BC}</SelectItem>
                <SelectItem value="CC">{typeLabels.CC}</SelectItem>
                <SelectItem value="CS">{typeLabels.CS}</SelectItem>
              </SelectContent>
            </Select>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search across sheets and rows..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64"
              />
            </div>

            

            {/* Mobile Menu */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0">
                <IndexPanel />
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Tablet horizontal strip */}
        <div className="hidden sm:block md:hidden border-t border-border p-2">
          <div className="flex gap-2 overflow-x-auto">
            {filteredItems.slice(0, 10).map((item) => (
              <Button
                key={item.id}
                variant={selectedItem?.id === item.id ? "default" : "ghost"}
                size="sm"
                onClick={() => setSelectedItem(item)}
                className="whitespace-nowrap flex-shrink-0"
              >
                {item.name}
              </Button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Desktop Index Panel */}
        <IndexPanel className="hidden md:flex w-[320px] shrink-0 h-full" />

        {/* Main Content */}
        <main className="flex-1 pt-[11px] pr-6 pb-6 pl-6 flex flex-col min-h-0 overflow-hidden">
          <div className="mb-3">
            <div className="flex items-center justify-between gap-3 mb-0">
              <h1 className="text-2xl font-bold text-balance">{selectedItem?.name ?? 'No sheet selected'}</h1>
              {selectedRows.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearAll}>Uncheck all</Button>
              )}
            </div>
          </div>
          {/* Desktop Table View */}
          <div className="hidden sm:flex flex-1 min-h-0 overflow-hidden">
            <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <CardContent className="p-0 flex-1 min-h-0 overflow-hidden">
                <div className="overflow-auto no-scrollbar h-full w-full">
                  <table className="min-w-max w-full text-sm table-auto">
                    <thead className="sticky top-0 z-10 bg-[#006fcf] text-[#f7f8f9]">
                      <tr className="border-b border-border">
                        {(selectedItem ? (sheetCache.current[`${selectedItem.type}:${selectedItem.name}`]?.columns ?? []) : []).map((col) => (
                          <th key={col} className="text-left p-3 font-semibold">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedItem && (sheetCache.current[`${selectedItem.type}:${selectedItem.name}`]?.rows ?? []).map((row, idx) => (
                        <TableRow
                          key={idx}
                          idx={idx}
                          selected={selectedRows.includes(idx)}
                          onSelect={() => toggleRow(idx)}
                          row={row}
                          columns={(sheetCache.current[`${selectedItem.type}:${selectedItem.name}`]?.columns ?? [])}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Mobile Card Layout */}
          <div className="sm:hidden space-y-4 overflow-auto no-scrollbar">
            {selectedItem && (sheetCache.current[`${selectedItem.type}:${selectedItem.name}`]?.rows ?? []).map((row, idx) => (
              <Card key={idx}>
                <CardContent className="p-4 space-y-2">
                  {(sheetCache.current[`${selectedItem.type}:${selectedItem.name}`]?.columns ?? []).map((col) => (
                    <div key={col} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{col}</span>
                      <span>{row[col] as any}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}

function TableRow({
  row,
  columns,
  idx,
  selected,
  onSelect,
}: {
  row: Record<string, any>
  columns: string[]
  idx: number
  selected: boolean
  onSelect: () => void
}) {
  return (
    <tr
      onClick={onSelect}
      className={cn(
        "border-b border-border cursor-pointer",
        selected && "bg-[#66a9e2] text-[#ffffff] font-semibold",
      )}
    >
      {columns.map((col) => (
        <td key={col} className="p-3 text-sm">
          {row[col] as any}
        </td>
      ))}
    </tr>
  )
}
