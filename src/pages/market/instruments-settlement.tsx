// Export, settlement price import and approval for the Instruments list. Ported from settlement-prices.js.
import { useReducer, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { WideSheet } from '@/components/market/module-head'
import { isoDateTime } from '@/lib/format'
import { downloadText, instrumentById, market, px, saveMarket, showDateTime, validScale } from '@/lib/market'
import { toast } from '@/lib/toast'

function csvField(value: any) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Downloads the (filtered) instruments as instruments.csv. */
export function exportInstruments(instruments: any[]) {
  const header = ['Product Name', 'ID (Symbol)', 'Description', 'Type', 'Tradable', 'Clearing House', 'Scheduled', 'State', 'Open', 'High', 'Low', 'Close', 'Last-Px', 'Settl-Px']
  const rows = instruments.map(i => {
    const s = i.stats || {}
    return [i.productId, i.id, i.description, i.type, i.nonTradable ? 'N' : 'Y', i.clearingHouse, i.isScheduled ? 'Scheduled' : 'Manual', i.state, s.open, s.high, s.low, s.close, s.lastPrice, s.settlementPrice]
  })
  downloadText('instruments.csv', [header, ...rows].map(r => r.map(csvField).join(',')).join('\n'))
  toast(`Exported ${rows.length} instrument${rows.length === 1 ? '' : 's'}.`)
}

export function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i += 1 }
      else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1
      row.push(cell)
      if (row.some(v => v.trim() !== '')) rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  row.push(cell)
  if (row.some(v => v.trim() !== '')) rows.push(row)
  const [head = [], ...body] = rows
  const keys = head.map(h => h.trim())
  return body.map(values => Object.fromEntries(keys.map((k, i) => [k, (values[i] ?? '').trim()])))
}

export function settlementRowErrors(rows: Record<string, string>[]) {
  const errors: string[] = []
  rows.forEach((row, index) => {
    if (!row.product_name || !row.instrument_id || !row.settlement_price) errors.push(`Row ${index + 1}: required fields are missing.`)
    else if (!Number.isFinite(Number(row.settlement_price))) errors.push(`Row ${index + 1}: settlement price for ${row.instrument_id} must be a number.`)
  })
  return errors
}

function SettlementStatus({ status }: { status: string }) {
  return status === 'Success' || status === 'Approved' ? <>{status}</> : <span className="text-bad" title={status}>{status}</span>
}

export type SettlementRow = Record<string, string> & { status: string }

/** Reads a settlement price CSV; calls `onRows` with the rows to import, or toasts why it can't. */
export function handleSettlementFile(file: File, onRows: (rows: SettlementRow[]) => void) {
  const reader = new FileReader()
  reader.onload = () => {
    const rows = parseCSV(String(reader.result))
    if (!rows.length) { toast('That file has no settlement prices.', { info: true }); return }
    const errors = settlementRowErrors(rows)
    if (errors.length) { toast(errors[0], { info: true }); return }
    onRows(rows.map(r => ({ ...r, status: 'Pending' })))
  }
  reader.readAsText(file)
}

/** "Import Settlement Prices": the parsed rows, then each row's result after Apply Prices. */
export function ImportSettlementSheet({ rows, onClose }: { rows: SettlementRow[] | null; onClose: () => void }) {
  const [applied, setApplied] = useState(false)
  const apply = () => {
    if (!rows) return
    let done = 0
    rows.forEach(r => {
      const inst = instrumentById(r.instrument_id)
      if (!inst) { r.status = 'Instrument not found'; return }
      if (!validScale(r.settlement_price, inst.minimumPriceIncrement)) { r.status = 'Price scale is not valid'; return }
      inst.stats = { ...inst.stats, settlementPrice: r.settlement_price, settlementSetTime: isoDateTime(new Date()), settlementPreliminary: true }
      r.status = 'Success'
      done += 1
    })
    saveMarket()
    setApplied(true)
    toast(`Imported ${done} of ${rows.length} settlement price${rows.length === 1 ? '' : 's'}.`)
  }
  return (
    <WideSheet
      open={!!rows}
      onOpenChange={open => { if (!open) { setApplied(false); onClose() } }}
      title="Import Settlement Prices"
      primaryLabel={applied ? undefined : 'Apply Prices'}
      onPrimary={apply}
    >
      <Card className="table-scroll">
        <Table className="table-wide">
          <TableHeader>
            <TableRow>
              <TableHead>Product Name</TableHead><TableHead>Instrument ID</TableHead><TableHead>Expiration Date</TableHead>
              <TableHead className="num">Settlement Price</TableHead><TableHead>Trading Date</TableHead><TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(rows || []).map((r, n) => (
              <TableRow key={n}>
                <TableCell>{r.product_name}</TableCell>
                <TableCell className="mono">{r.instrument_id}</TableCell>
                <TableCell>{r.expiration_date}</TableCell>
                <TableCell className="num">{r.settlement_price}</TableCell>
                <TableCell>{r.trading_date}</TableCell>
                <TableCell><SettlementStatus status={r.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </WideSheet>
  )
}

export type ApproveRow = { inst: any; selected: boolean; status: string }

/** The approval rows (instruments with a preliminary settlement price), or null with a toast when there are none. */
export function approveRows(): ApproveRow[] | null {
  const rows = market().instruments.filter(i => (i.stats || {}).settlementPreliminary).map(i => ({ inst: i, selected: false, status: 'Pending' }))
  if (!rows.length) {
    toast('No instruments found for approval.', { info: true })
    return null
  }
  return rows
}

/** "Approve Settlement Prices": tick preliminary prices and approve them. */
export function ApproveSettlementSheet({ rows, onClose }: { rows: ApproveRow[] | null; onClose: () => void }) {
  const [, paint] = useReducer((x: number) => x + 1, 0)
  const list = rows || []
  const pending = list.filter(r => r.status === 'Pending')
  const allOn = pending.length > 0 && pending.every(r => r.selected)
  const approve = () => {
    const chosen = list.filter(r => r.selected && r.status === 'Pending')
    if (!chosen.length) {
      toast('No settlement prices selected for approval.', { info: true })
      return
    }
    chosen.forEach(r => {
      r.inst.stats.settlementPreliminary = false
      r.status = 'Approved'
      r.selected = false
    })
    saveMarket()
    paint()
    toast(`Approved ${chosen.length} settlement price${chosen.length === 1 ? '' : 's'}.`)
  }
  return (
    <WideSheet open={!!rows} onOpenChange={open => { if (!open) onClose() }} title="Approve Settlement Prices" primaryLabel="Approve Prices" onPrimary={approve}>
      <Card className="table-scroll">
        <Table className="table-wide">
          <TableHeader>
            <TableRow>
              <TableHead className="check-cell">
                <Checkbox checked={allOn} aria-label="Select all" onCheckedChange={c => { list.forEach(r => { if (r.status === 'Pending') r.selected = c === true }); paint() }} />
              </TableHead>
              <TableHead>Product Name</TableHead><TableHead>Instrument ID</TableHead><TableHead>Expiration Date</TableHead>
              <TableHead className="num">Settlement Price</TableHead><TableHead>Settlement Set Time</TableHead><TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map(r => (
              <TableRow key={r.inst.id}>
                <TableCell className="check-cell">
                  <Checkbox checked={r.selected} disabled={r.status === 'Approved'} aria-label={`Select ${r.inst.id}`} onCheckedChange={c => { r.selected = c === true; paint() }} />
                </TableCell>
                <TableCell>{r.inst.productId}</TableCell>
                <TableCell className="mono">{r.inst.id}</TableCell>
                <TableCell>{showDateTime(r.inst.expirationDate)}</TableCell>
                <TableCell className="num">{px(r.inst, r.inst.stats.settlementPrice)}</TableCell>
                <TableCell>{showDateTime(r.inst.stats.settlementSetTime)}</TableCell>
                <TableCell><SettlementStatus status={r.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </WideSheet>
  )
}
