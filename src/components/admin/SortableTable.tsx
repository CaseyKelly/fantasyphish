"use client"

import { ReactNode, useMemo, useState } from "react"
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"

export interface Column<T> {
  key: string
  header: string
  sortable?: boolean
  accessor?: (row: T) => string | number | null
  render?: (row: T) => ReactNode
  align?: "left" | "right" | "center"
}

interface SortableTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  initialSortKey?: string
  initialSortDir?: "asc" | "desc"
  emptyMessage?: string
}

function alignClass(align?: "left" | "right" | "center"): string {
  if (align === "right") return "text-right"
  if (align === "center") return "text-center"
  return "text-left"
}

export function SortableTable<T>({
  columns,
  rows,
  rowKey,
  initialSortKey,
  initialSortDir = "desc",
  emptyMessage = "No data",
}: SortableTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | undefined>(initialSortKey)
  const [sortDir, setSortDir] = useState<"asc" | "desc">(initialSortDir)

  const getValue = (column: Column<T>, row: T): string | number | null => {
    if (column.accessor) return column.accessor(row)
    const value = (row as unknown as Record<string, unknown>)[column.key]
    return value === undefined ? null : (value as string | number | null)
  }

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows
    const column = columns.find((c) => c.key === sortKey)
    if (!column) return rows

    return [...rows].sort((a, b) => {
      const av = getValue(column, a)
      const bv = getValue(column, b)
      if (av === null && bv === null) return 0
      if (av === null) return 1
      if (bv === null) return -1
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av
      }
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sortKey, sortDir, columns])

  const handleSort = (column: Column<T>) => {
    if (!column.sortable) return
    if (sortKey === column.key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(column.key)
      setSortDir("desc")
    }
  }

  if (rows.length === 0) {
    return <p className="text-sm text-gray-400">{emptyMessage}</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="bg-[#2d4654]">
            {columns.map((column) => (
              <th
                key={column.key}
                onClick={() => handleSort(column)}
                className={`border-b-2 border-[#3d5a6c]/60 px-3 py-2 font-semibold whitespace-nowrap text-gray-300 ${alignClass(
                  column.align
                )} ${column.sortable ? "cursor-pointer select-none hover:text-white" : ""}`}
              >
                <span className="inline-flex items-center gap-1">
                  {column.header}
                  {column.sortable &&
                    (sortKey === column.key ? (
                      sortDir === "asc" ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )
                    ) : (
                      <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                    ))}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr
              key={rowKey(row)}
              className="border-b border-[#3d5a6c]/30 hover:bg-[#3d5a6c]/20"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`px-3 py-2 whitespace-nowrap text-gray-300 ${alignClass(column.align)}`}
                >
                  {column.render
                    ? column.render(row)
                    : (getValue(column, row) ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
