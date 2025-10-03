import { NextResponse } from 'next/server'
import { indexForType } from '@/lib/excel/parse'
import type { ProductType } from '@/lib/excel/files'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') as ProductType | null
  if (!type || !['BC','CC','CS'].includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }
  try {
    const items = indexForType(type)
    return NextResponse.json(items)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to read index' }, { status: 500 })
  }
}

