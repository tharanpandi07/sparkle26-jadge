import * as XLSX from 'xlsx'

// one row per participant / team: details, every criterion for Judge 1 and Judge 2, totals, rank
export function downloadScoresExcel(event, spec, rows, showJ2 = true) {
  const max = spec.maxTotal
  const data = rows.map((e) => {
    const row = {
      Rank: e.rank || '',
      'Participant / Team': e.name,
      Members: e.members.map((m) => m.name).join(', '),
      College: e.college,
      Department: e.department,
      'Year / Class': e.year,
      Present: e.present ? 'Yes' : 'No',
      Registered: e.source === 'ONSPOT' ? 'On-spot' : 'Online'
    }
    spec.criteria.forEach((c) => { row[`J1 ${c.group ? c.group + ' - ' : ''}${c.label} (${c.max})`] = e.marks1?.[c.key] ?? '' })
    row[`Judge 1 total (${max})`] = e.judge1 ?? ''
    if (showJ2) spec.criteria.forEach((c) => { row[`J2 ${c.group ? c.group + ' - ' : ''}${c.label} (${c.max})`] = e.marks2?.[c.key] ?? '' })
    if (showJ2) { row[`Judge 2 total (${max})`] = e.judge2 ?? ''; row['Total'] = e.total ?? '' }
    row[`Average (${max})`] = e.average ?? ''
    row['Judge 1 remarks'] = e.remarks1 || ''
    if (showJ2) row['Judge 2 remarks'] = e.remarks2 || ''
    return row
  })
  const ws = XLSX.utils.json_to_sheet(data)
  ws['!cols'] = Object.keys(data[0] || {}).map((k) => ({ wch: Math.max(10, Math.min(34, k.length + 2)) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Scores')
  XLSX.writeFile(wb, `scores-${event.id}.xlsx`)
}
