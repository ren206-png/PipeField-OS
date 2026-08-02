"use client";

import type { CalcResult } from "./SupportCalculator";
import { PdfTriggerButton } from "./PdfTriggerButton";

type Props = { result: CalcResult; inputs: Record<string, unknown>; savedId?: string | null };

const Section = ({ num, title, children }: { num: number; title: string; children: React.ReactNode }) => (
  <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
    <div className="flex items-center gap-3 border-b border-gray-800 px-5 py-3">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">{num}</span>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const Row = ({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) => (
  <div className="flex items-center justify-between border-b border-gray-800/50 py-2 last:border-0">
    <span className="text-xs text-gray-400">{label}</span>
    <span className={`text-sm font-medium ${className ?? "text-gray-100"}`}>{value}</span>
  </div>
);

const Badge = ({ pass }: { pass: boolean }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
    pass ? "bg-green-500/10 text-green-400 border border-green-500/30"
          : "bg-red-500/10 text-red-400 border border-red-500/30"
  }`}>
    <span className={`h-1.5 w-1.5 rounded-full ${pass ? "bg-green-400" : "bg-red-400"}`} />
    {pass ? "PASS" : "FAIL"}
  </span>
);

const StatCard = ({ label, value, unit }: { label: string; value: string | number; unit?: string }) => (
  <div className="rounded-lg border border-gray-800 bg-gray-900 p-3 text-center">
    <div className="text-lg font-bold text-white">{value}{unit && <span className="text-xs text-gray-500 ml-1">{unit}</span>}</div>
    <div className="text-xs text-gray-500 mt-0.5">{label}</div>
  </div>
);

export default function OutputScreen({ result, inputs, savedId }: Props) {
  const { dimensions: dims, areas, weights, span, slope, hydrotest, weld_clearance, turnaround } = result;

  return (
    <div className="space-y-4">
      {/* Summary stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Selected Span" value={span.selected_ft} unit="ft" />
        <StatCard label="Total Weight" value={weights.total_lbft} unit="lb/ft" />
        <StatCard label="Hydrotest Load" value={hydrotest.P_test_lb} unit="lb" />
        <StatCard label="Weld Clearance" value={weld_clearance.pass ? "PASS" : "FAIL"} />
      </div>

      {/* Section 1 — System Configuration */}
      <Section num={1} title="System Configuration">
        <div className="space-y-0">
          <Row label="Pipe Size (NPS)" value={String(inputs.nps ?? "—")} />
          <Row label="Schedule" value={String(inputs.schedule ?? "—")} />
          <Row label="Standard" value={String(inputs.standard ?? "—")} />
          <Row label="Material" value={String(inputs.material ?? "—").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())} />
          <Row label="Fluid Service" value={String(inputs.fluid ?? "—")} />
          <Row label="Design Basis" value={String(inputs.design_basis ?? "—")} />
          <Row label="Project Phase" value={String(inputs.project_phase ?? "—").replace(/_/g, " ")} />
        </div>
      </Section>

      {/* Section 2 — Load Summary */}
      <Section num={2} title="Load Summary">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
          <StatCard label="Metal" value={weights.metal_lbft.toFixed(2)} unit="lb/ft" />
          <StatCard label="Fluid" value={weights.fluid_lbft.toFixed(3)} unit="lb/ft" />
          <StatCard label="Insulation" value={weights.insulation_lbft.toFixed(3)} unit="lb/ft" />
          <StatCard label="Total Operating" value={weights.total_lbft.toFixed(2)} unit="lb/ft" />
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-950 p-3 space-y-1">
          <div className="text-xs text-gray-500 mb-2 font-medium">Pipe Dimensions</div>
          <Row label="Outside Diameter (OD)" value={`${dims.OD_in} in`} />
          <Row label="Wall Thickness" value={`${dims.wall_in} in`} />
          <Row label="Inside Diameter (ID)" value={`${dims.ID_in} in`} />
          <Row label="Metal Area" value={`${areas.metal_area_in2.toFixed(4)} in²`} />
          <Row label="Fluid Flow Area" value={`${areas.fluid_area_in2.toFixed(4)} in²`} />
          {areas.insulation_area_in2 > 0 && (
            <Row label="Insulation Area" value={`${areas.insulation_area_in2.toFixed(4)} in²`} />
          )}
        </div>
        <p className="mt-2 text-xs text-gray-600">
          Unit conversion: fluid/insulation densities converted lb/ft³ → lb/in³ (÷ 1728) for calculation.
        </p>
      </Section>

      {/* Section 3 — Support Layout */}
      <Section num={3} title="Support Layout">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
          <StatCard label="Calculated" value={span.calculated_ft.toFixed(2)} unit="ft" />
          <StatCard label="Recommended" value={span.recommended_ft} unit="ft" />
          {span.company_ft && <StatCard label="Company Std" value={span.company_ft} unit="ft" />}
          <StatCard label="Selected" value={span.selected_ft} unit="ft" />
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-950 p-3 space-y-1">
          <Row label="Moment of Inertia (I)" value={`${span.moment_of_inertia_in4.toFixed(4)} in⁴`} />
          <Row label="Elastic Modulus (E)" value={`${span.elastic_modulus_psi.toLocaleString()} psi`} />
          <Row label="Allowable Deflection" value={`${inputs.deflection_allow_in ?? 0.10} in`} />
        </div>
        <p className="mt-2 text-xs text-amber-600/80">
          ⚠ Allowable deflection of 0.10&quot; is an engineering design criterion, not a universal ASME code requirement.
        </p>
      </Section>

      {/* Section 4 — Weld Clearance */}
      <Section num={4} title="Weld Clearance Review">
        <div className="flex items-center gap-4 mb-4">
          <Badge pass={weld_clearance.pass} />
          <span className="text-sm text-gray-400">
            {weld_clearance.conflicts.length} conflict{weld_clearance.conflicts.length !== 1 ? "s" : ""} detected
          </span>
        </div>
        {weld_clearance.conflicts.length > 0 && (
          <div className="space-y-2">
            {weld_clearance.conflicts.map((c, i) => (
              <div key={i} className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs">
                <div className="text-yellow-400 font-medium mb-1">Conflict {i + 1}</div>
                <div className="text-gray-400">
                  Support at <span className="text-white">{c.original_ft.toFixed(2)} ft</span> →
                  weld at <span className="text-white">{c.weld_ft.toFixed(2)} ft</span> |
                  gap <span className="text-red-400">{c.gap_in.toFixed(3)}&quot;</span> &lt; required |
                  shifted <span className="text-green-400">{c.shifted_by_in.toFixed(3)}&quot;</span> →
                  new position <span className="text-white">{c.adjusted_to_ft.toFixed(3)} ft</span>
                </div>
              </div>
            ))}
            <div className="mt-2">
              <div className="text-xs text-gray-500 mb-1">Adjusted Positions (ft):</div>
              <div className="text-sm text-gray-300 font-mono">
                {weld_clearance.adjusted_locations_ft.map(l => l.toFixed(3)).join(" | ")}
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* Section 5 — Slope Report */}
      <Section num={5} title="Slope Report">
        <Row label="Slope Mode" value={String(inputs.slope_mode ?? "—")} />
        {slope.drop_decimal_in !== undefined && (
          <>
            <Row label="Slope" value={`${inputs.slope_value} in/ft`} />
            <Row label="Run Length" value={`${span.selected_ft} ft (selected span)`} />
            <Row label="Elevation Drop — Decimal" value={`${slope.drop_decimal_in?.toFixed(4) ?? "—"} in`} className="text-orange-400" />
            <Row label="Elevation Drop — Fractional" value={slope.drop_fraction_str ?? "—"} className="text-orange-400 text-base font-bold" />
          </>
        )}
        {slope.min_slope_in_per_ft !== undefined && (
          <>
            <Row label="Minimum Slope Required" value={`${slope.min_slope_in_per_ft?.toFixed(4)} in/ft`} className="text-orange-400" />
            <Row label="Drop (at min slope)" value={slope.drop_fraction_str ?? "—"} className="text-orange-400" />
          </>
        )}
      </Section>

      {/* Section 6 — Hydrotest Review */}
      <Section num={6} title="Hydrotest Review">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
          <StatCard label="Water Weight" value={hydrotest.W_water_lbft.toFixed(3)} unit="lb/ft" />
          <StatCard label="Test Weight" value={hydrotest.W_test_lbft.toFixed(2)} unit="lb/ft" />
          <StatCard label="Load per Support" value={hydrotest.P_test_lb.toFixed(0)} unit="lb" />
          <StatCard label="Increase vs Operating" value={`${hydrotest.percent_increase.toFixed(1)}%`} />
        </div>
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-300">
          Hydrotest load calculated using water (62.4 lb/ft³) regardless of operating fluid service.
        </div>
      </Section>

      {/* Section 7 — Turnaround Remediation */}
      {turnaround && (
        <Section num={7} title="Turnaround Remediation">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <StatCard label="Shim Thickness" value={turnaround.shim_fraction_str} />
            <StatCard label="Remaining Slot Travel" value={`${turnaround.remaining_travel_after_shim_in.toFixed(3)} in`} />
          </div>
          <Row label="Shim Thickness (Decimal)" value={`${turnaround.shim_thickness_in.toFixed(4)} in`} />
          <Row label="Thermal Growth Allowance" value={`${turnaround.thermal_growth_allowance_in.toFixed(4)} in`} />
          {turnaround.slot_travel_warning && (
            <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
              ⚠ {turnaround.warning_message}
            </div>
          )}
        </Section>
      )}

      {/* Section 8 — Calculation Sheet PDF */}
      <Section num={8} title="Calculation Sheet">
        <div className="space-y-3">
          <p className="text-xs text-gray-400">
            Download a printable PDF calculation sheet suitable for attaching to your engineering package or ITP.
            Save the calculation first to stamp it with a record ID.
          </p>
          <PdfTriggerButton
            calcName={String(inputs.nps ?? '') + `" NPS Pipe Support — ` + String(inputs.support_type ?? '').replace(/_/g, ' ')}
            inputs={inputs}
            result={result as unknown as Record<string, unknown>}
            calculationId={savedId ?? undefined}
            variant="primary"
          />
        </div>
      </Section>

      {/* Section 9 — Access Interference */}
      <Section num={9} title="Access Interference Review">
        <p className="text-xs text-gray-500">
          Pass <code className="text-orange-400">access_zones</code> in the calculation request to check
          support locations against valve, equipment, and maintenance access clearances.
        </p>
      </Section>

      {/* Section 10 — Procurement Summary */}
      <Section num={10} title="Procurement Summary">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ["Supports", `${weld_clearance.adjusted_locations_ft.length || "—"} ea`],
            ["Span", `${span.selected_ft} ft`],
            ["Hydrotest Load", `${hydrotest.P_test_lb.toFixed(0)} lb`],
          ].map(([label, val]) => (
            <div key={label} className="rounded-lg border border-gray-800 bg-gray-900 p-3">
              <div className="text-sm font-bold text-white">{val}</div>
              <div className="text-xs text-gray-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-gray-600">
          Full procurement BOM generated via <code className="text-orange-400">POST /reports/field-sheet</code>.
        </p>
      </Section>

      {/* Engineering Notice */}
      <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 px-4 py-3 text-xs text-orange-300">
        <strong>ENGINEERING NOTICE:</strong> This tool supplements engineering judgment and field execution.
        It does not replace Professional Engineering review where required by code, regulation, or project specification.
      </div>
    </div>
  );
}
