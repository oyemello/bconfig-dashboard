import { NextResponse } from 'next/server'
import type { ProductType } from '@/lib/excel/files'
import { indexForType, sheetToData } from '@/lib/excel/parse'

type ChatMessage = { role: 'user' | 'assistant'; content: string }
type ProductParam = ProductType | 'ALL'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function pickColumn(columns: string[], names: string[]): string | null {
  const lowered = columns.map((c) => c?.toString?.().trim().toLowerCase() || '')
  // Prefer exact match
  for (const name of names) {
    const target = name.toLowerCase()
    const i = lowered.indexOf(target)
    if (i !== -1) return columns[i]
  }
  // Fallback: substring match
  for (const name of names) {
    const target = name.toLowerCase()
    const i = lowered.findIndex((c) => c.includes(target))
    if (i !== -1) return columns[i]
  }
  return null
}

function text(val: any): string {
  if (val === null || val === undefined) return ''
  return String(val)
}

function scoreRow(query: string, row: Record<string, any>, labelCol?: string | null, descCol?: string | null, destCol?: string | null) {
  const qTokens = query.split(/\s+/).filter(Boolean)
  const lc = (s: string) => s.toLowerCase()
  let score = 0
  const label = lc(text(labelCol ? row[labelCol] : ''))
  const desc = lc(text(descCol ? row[descCol] : ''))
  const dest = lc(text(destCol ? row[destCol] : ''))

  for (const t of qTokens) {
    if (!t) continue
    if (label.includes(t)) score += 3
    if (desc.includes(t)) score += 2
    if (dest.includes(t)) score += 2
  }
  // Light score from all cells
  const all = lc(Object.values(row).map(text).join(' \n '))
  for (const t of qTokens) {
    if (all.includes(t)) score += 1
  }
  return score
}

function truncate(s: string, n: number) {
  if (s.length <= n) return s
  return s.slice(0, n - 1) + '…'
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({})) as { messages?: ChatMessage[]; product?: ProductParam }
    const messages = (body.messages ?? []).filter((m) => m && (m.role === 'user' || m.role === 'assistant')) as ChatMessage[]
    const product = body.product as ProductParam | undefined
    if (!process.env.AMEX_E2_TOKEN) {
      return NextResponse.json({ error: 'Missing AMEX_E2_TOKEN' }, { status: 500 })
    }
    if (!product || !['BC','CC','CS','ALL'].includes(product)) {
      return NextResponse.json({ error: 'Invalid or missing product' }, { status: 400 })
    }
    if (messages.length === 0) {
      return NextResponse.json({ error: 'Missing messages' }, { status: 400 })
    }

    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    const query = (lastUser?.content || '').toLowerCase().trim()

    // Collect candidates across sheets for the selected product(s)
    const typeLabelMap: Record<ProductType, string> = {
      BC: 'Business Checking',
      CC: 'Consumer Checking',
      CS: 'Consumer Savings',
    }
    const types: ProductType[] = product === 'ALL' ? ['BC','CC','CS'] : [product]
    const candidates: Array<{
      workbook: string
      sheet: string
      label: string
      description: string
      destination: string
      score: number
    }> = []

    for (const ptype of types) {
      const sheets = indexForType(ptype).map((it) => it.name)
      for (const sheet of sheets) {
        try {
          const data = sheetToData(ptype, sheet)
          const labelCol = pickColumn(data.columns, ['Screen Label', 'Label'])
          const descCol = pickColumn(data.columns, ['Additional Field Description', 'Description', 'Field Description'])
          const destCol = pickColumn(data.columns, ['Destination', 'Screen Destination'])
          for (const row of data.rows) {
            const s = scoreRow(query, row, labelCol, descCol, destCol)
            if (s <= 0) continue
            candidates.push({
              workbook: typeLabelMap[ptype] || String(ptype),
              sheet,
              label: text(labelCol ? row[labelCol] : ''),
              description: text(descCol ? row[descCol] : ''),
              destination: text(destCol ? row[destCol] : ''),
              score: s,
            })
          }
        } catch {}
      }
    }

    // If user scoped to a single product but we found no candidates, widen to all products
    if (product !== 'ALL' && candidates.length === 0) {
      for (const ptype of ['BC','CC','CS'] as ProductType[]) {
        if (ptype === product) continue
        const sheets = indexForType(ptype).map((it) => it.name)
        for (const sheet of sheets) {
          try {
            const data = sheetToData(ptype, sheet)
            const labelCol = pickColumn(data.columns, ['Screen Label', 'Label'])
            const descCol = pickColumn(data.columns, ['Additional Field Description', 'Description', 'Field Description'])
            const destCol = pickColumn(data.columns, ['Destination', 'Screen Destination'])
            for (const row of data.rows) {
              const s = scoreRow(query, row, labelCol, descCol, destCol)
              if (s <= 0) continue
              candidates.push({
                workbook: typeLabelMap[ptype] || String(ptype),
                sheet,
                label: text(labelCol ? row[labelCol] : ''),
                description: text(descCol ? row[descCol] : ''),
                destination: text(destCol ? row[destCol] : ''),
                score: s,
              })
            }
          } catch {}
        }
      }
    }

    candidates.sort((a, b) => b.score - a.score)
    const top = candidates.slice(0, 8).map((c) => ({
      workbook: c.workbook,
      title: c.sheet,
      label: truncate(c.label, 300),
      description: truncate(c.description, 400),
      destination: truncate(c.destination, 200),
      score: c.score,
    }))

    const systemPrompt = `You are an AI assistant helping a user find fields in Excel configuration workbooks.

Follow these strict rules when responding:
- If exactly one strong match: respond exactly as:
Here's what you might be looking for:
Workbook: (which workbook)
Title: (sheet name)
Label: (label)
Description: (description)

- If two or more plausible matches: respond exactly as:
I found **N results** that match what you are looking for:
1. Workbook: (which workbook)
   Title: (sheet name)
   Label: (label)
   Description: (description)
2. ...

Additional constraints:
- Replace N with the number of results shown (e.g., 3) and bold only the phrase "N results" (e.g., **3 results**).
- Use only items present in the "Top matches" context, in the same order; do not invent values.
- List up to the items provided in context; do not include destination.
- Remove exact duplicates (same workbook+title+label+description).
- Do not repeat any header per item; no extra commentary before or after.
- If zero plausible matches, ask a brief clarifying question instead.
- Prefer matches where query terms appear in the label or the additional field description.`

    const contextMsg = `Top matches (pre-filtered context). Use for reference only. Each item: {workbook, title, label, description, destination}.
${top.map((t, i) => `${i + 1}. ${JSON.stringify(t)}`).join('\n')}`

    const model = process.env.AI_MODEL || 'gpt-4.1'
    const payload = {
      model,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'system', content: contextMsg },
        ...messages,
      ],
    }

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.AMEX_E2_TOKEN}`,
      },
      body: JSON.stringify(payload),
    })

    if (!resp.ok) {
      const err = await resp.text().catch(() => '')
      return NextResponse.json({ error: `LLM error: ${resp.status} ${err}` }, { status: 500 })
    }
    const data = await resp.json()
    const content: string = data?.choices?.[0]?.message?.content ?? ''
    return NextResponse.json({ message: { role: 'assistant', content } })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'AI route failed' }, { status: 500 })
  }
}
