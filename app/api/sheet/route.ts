import { NextResponse } from 'next/server'
import { sheetToData } from '@/lib/excel/parse'
import type { ProductType } from '@/lib/excel/files'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') as ProductType | null
  const sheet = searchParams.get('sheet')
  if (!type || !['BC','CC','CS'].includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }
  if (!sheet) {
    return NextResponse.json({ error: 'Missing sheet' }, { status: 400 })
  }
  try {
    const data = sheetToData(type, sheet)
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to read sheet' }, { status: 500 })
  }
}

