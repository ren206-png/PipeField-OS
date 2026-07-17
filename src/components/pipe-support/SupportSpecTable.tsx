'use client'
import { useState } from 'react'

const ROWS = [
  {
    component: 'Rigid Base Anchor',
    tag: 'FPS-RIGID-01',
    material: 'Carbon Steel A36',
    maxLoad: '45 kN',
    code: 'ASME B31.3',
    colorClass: 'text-indigo-600',
  },
  {
    component: 'Variable Spring Hanger',
    tag: 'FPS-SPRING-02',
    material: 'Stainless Steel 304',
    maxLoad: 'Variable Range',
    code: 'MSS SP-58',
    colorClass: 'text-blue-600',
  },
  {
    component: 'Hydraulic Shock Snubber',
    tag: 'FPS-SHOCK-03',
    material: 'Alloy Steel / Chrome',
    maxLoad: 'Velocity Locked',
    code: 'MSS SP-58',
    colorClass: 'text-teal-600',
  },
]

export function SupportSpecTable() {
  const [filter, setFilter] = useState('')
  const q = filter.toLowerCase()
  const filtered = q
    ? ROWS.filter(r =>
        [r.component, r.tag, r.material, r.maxLoad, r.code]
          .some(cell => cell.toLowerCase().includes(q))
      )
    : ROWS

  return (
    <div className="support-data-table my-12">
      <h2 className="text-2xl font-bold text-slate-900 border-b pb-2 mb-6">Engineering Specifications Inventory</h2>
      <p className="text-sm text-slate-500 mb-6">Reference values shown for demonstration. Verify against project support drawings and manufacturer data.</p>

      {/* Text filter */}
      <div className="mb-4">
        <input
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter by component, tag, material, code…"
          className="w-full max-w-sm px-4 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        {filter && (
          <button
            onClick={() => setFilter('')}
            className="ml-2 text-xs text-slate-400 hover:text-slate-600 underline"
          >
            Clear
          </button>
        )}
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="min-w-full divide-y divide-slate-200 text-sm text-left text-slate-700">
          <thead className="bg-slate-50 text-slate-400 font-medium uppercase text-xs tracking-wider">
            <tr>
              <th className="px-6 py-4">Component</th>
              <th className="px-6 py-4">Support Tag</th>
              <th className="px-6 py-4">Primary Material</th>
              <th className="px-6 py-4">Max Load Capacity</th>
              <th className="px-6 py-4">Compliance Code</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-400 text-sm">
                  No results for &ldquo;{filter}&rdquo;
                </td>
              </tr>
            ) : (
              filtered.map(row => (
                <tr key={row.tag} className="hover:bg-slate-50">
                  <td className={`px-6 py-4 font-bold ${row.colorClass}`}>{row.component}</td>
                  <td className="px-6 py-4 font-semibold text-slate-900">{row.tag}</td>
                  <td className="px-6 py-4">{row.material}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{row.maxLoad}</td>
                  <td className="px-6 py-4">
                    <span className="bg-slate-100 text-slate-800 text-xs px-2.5 py-0.5 rounded-full font-medium">
                      {row.code}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
