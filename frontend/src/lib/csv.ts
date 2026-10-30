const escapeCsv = (value: string | number | boolean | null | undefined): string => {
  if (value === null || value === undefined) return ''
  const stringified = String(value)
  if (stringified.includes(',') || stringified.includes('"') || stringified.includes('\n')) {
    return `"${stringified.replaceAll('"', '""')}"`
  }
  return stringified
}

export const downloadCsv = (filename: string, headers: string[], rows: Array<Array<string | number | boolean | null | undefined>>) => {
  const content = [headers, ...rows].map((row) => row.map((cell) => escapeCsv(cell)).join(',')).join('\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()

  URL.revokeObjectURL(url)
}
