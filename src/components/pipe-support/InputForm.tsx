"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { QRScanButton } from "@/components/shared/QRScanButton";
import type { QRScanResult } from "@/hooks/useQRScanner";
import type { ProjectListItem } from "@/hooks/useProjects";

const NPS_SIZES = ["0.5","0.75","1.0","1.25","1.5","2.0","2.5","3.0","3.5","4.0","5.0","6.0","8.0","10.0","12.0","14.0","16.0","18.0","20.0","24.0","30.0","36.0","42.0","48.0","60.0"];
const SCHEDULES = ["SCH10","SCH20","SCH30","SCH40","SCH60","SCH80","SCH100","SCH120","SCH140","SCH160","STD","XS","XXS","SCH5S","SCH10S","SCH40S","SCH80S"];
const MATERIALS = ["carbon_steel","stainless_steel","copper"];
const FLUIDS = ["water","steam","condensate","air","nitrogen","natural_gas","crude_oil","custom"];
const INSULATION_THICKNESSES = [0, 0.5, 1.0, 1.5, 2.0, 3.0, 4.0];
const SUPPORT_TYPES = ["clevis_hanger","trapeze","pipe_shoe","trunnion","spring_hanger","custom"];
const DESIGN_BASES = ["B31.3","B31.1"];

type Props = {
  onCalculate: (data: Record<string, unknown>) => void;
  loading: boolean;
  projects?: ProjectListItem[];
  selectedProject?: string;
  onProjectChange?: (id: string) => void;
};

const Field = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <div className="space-y-1">
    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</label>
    {children}
    {hint && <p className="text-xs text-gray-600">{hint}</p>}
  </div>
);

const Select = ({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) => (
  <select
    value={value}
    onChange={e => onChange(e.target.value)}
    className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-orange-500 focus:outline-none"
  >
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
);

const NumberInput = ({ value, onChange, min, max, step, placeholder }: {
  value: number | string; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; placeholder?: string;
}) => (
  <input
    type="number"
    value={value}
    onChange={e => onChange(parseFloat(e.target.value))}
    min={min} max={max} step={step ?? 0.001}
    placeholder={placeholder}
    className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-orange-500 focus:outline-none"
  />
);

const PhaseButton = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
      active ? "bg-orange-500 text-white" : "border border-gray-700 text-gray-400 hover:border-orange-500"
    }`}
  >
    {label}
  </button>
);

const SupportTypeBtn = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-lg px-3 py-2 text-xs font-medium transition-all ${
      active ? "bg-orange-500 text-white" : "border border-gray-700 text-gray-400 hover:border-orange-500"
    }`}
  >
    {label.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
  </button>
);

const SectionCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-4">
    <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wider">{title}</h3>
    {children}
  </div>
);

export default function InputForm({ onCalculate, loading, projects = [], selectedProject = '', onProjectChange }: Props) {
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState("new_construction");
  const [nps, setNps] = useState("4.0");
  const [schedule, setSchedule] = useState("SCH40");
  const [standard, setStandard] = useState("B36.10M");
  const [material, setMaterial] = useState("carbon_steel");
  const [fluid, setFluid] = useState("water");
  const [tIns, setTIns] = useState(0);
  const [insDensity, setInsDensity] = useState(5.0);
  const [supportType, setSupportType] = useState("clevis_hanger");
  const [designBasis, setDesignBasis] = useState("B31.3");
  const [slopeMode, setSlopeMode] = useState("fixed");
  const [slopeValue, setSlopeValue] = useState(0.125);
  const [deflection, setDeflection] = useState(0.10);
  const [clearanceIn, setClearanceIn] = useState(2.0);
  const [weldLocs, setWeldLocs] = useState("");
  const [supLocs, setSupLocs] = useState("");
  const [spanCompany, setSpanCompany] = useState<number | "">("");
  const [hydrotest, setHydrotest] = useState(false);

  // Turnaround fields
  const [existingSag, setExistingSag] = useState(0);
  const [existingElev, setExistingElev] = useState(0);
  const [slotTravel, setSlotTravel] = useState(1.0);
  const [thermalGrowth, setThermalGrowth] = useState(0);

  // ── QR / URL param pre-fill ────────────────────────────────
  useEffect(() => {
    const qrNps      = searchParams.get('nps')
    const qrSchedule = searchParams.get('schedule')
    const qrFluid    = searchParams.get('fluid')
    if (qrNps      && NPS_SIZES.includes(qrNps))      setNps(qrNps)
    if (qrSchedule && SCHEDULES.includes(qrSchedule)) setSchedule(qrSchedule)
    if (qrFluid    && FLUIDS.includes(qrFluid))        setFluid(qrFluid)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleQRResult(result: QRScanResult) {
    if (result.type === 'calc') {
      if (NPS_SIZES.includes(result.nps))          setNps(result.nps)
      if (SCHEDULES.includes(result.schedule))     setSchedule(result.schedule)
      if (FLUIDS.includes(result.fluid))           setFluid(result.fluid)
    }
  }

  const parseLocations = (str: string) =>
    str.split(",").map(s => parseFloat(s.trim())).filter(n => !isNaN(n));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      project_id: selectedProject || null,
      nps, schedule, standard, material, fluid,
      insulation_thickness_in: tIns,
      insulation_density_lbft3: insDensity,
      support_type: supportType,
      design_basis: designBasis,
      slope_mode: slopeMode,
      slope_value: slopeValue,
      deflection_allow_in: deflection,
      clearance_in: clearanceIn,
      weld_locations_ft: parseLocations(weldLocs),
      support_locations_ft: parseLocations(supLocs),
      hydrotest_mode: hydrotest,
      project_phase: phase,
    };
    if (spanCompany !== "") payload.span_company_ft = spanCompany;
    if (phase === "turnaround") {
      payload.existing_sag_in = existingSag;
      payload.existing_support_elevation_in = existingElev;
      payload.remaining_slot_travel_in = slotTravel;
      payload.thermal_growth_in = thermalGrowth;
    }
    onCalculate(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Project selector */}
      {projects.length > 0 && (
        <SectionCard title="Project">
          <select
            value={selectedProject}
            onChange={e => onProjectChange?.(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-orange-500 focus:outline-none"
          >
            <option value="">— Select project (optional) —</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.project_number ? `[${p.project_number}] ` : ''}{p.name}
              </option>
            ))}
          </select>
        </SectionCard>
      )}

      {/* Project Phase */}
      <SectionCard title="A. Project Phase">
        <div className="flex gap-3">
          <PhaseButton label="New Construction" active={phase === "new_construction"} onClick={() => setPhase("new_construction")} />
          <PhaseButton label="Turnaround / Revamp" active={phase === "turnaround"} onClick={() => setPhase("turnaround")} />
        </div>
        {phase === "turnaround" && (
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-800">
            <Field label="Existing Sag (in)"><NumberInput value={existingSag} onChange={setExistingSag} /></Field>
            <Field label="Support Elevation (in)"><NumberInput value={existingElev} onChange={setExistingElev} /></Field>
            <Field label="Remaining Slot Travel (in)"><NumberInput value={slotTravel} onChange={setSlotTravel} /></Field>
            <Field label="Thermal Growth (in)"><NumberInput value={thermalGrowth} onChange={setThermalGrowth} /></Field>
          </div>
        )}
      </SectionCard>

      {/* Pipe Characteristics */}
      <SectionCard title="B. Pipe Characteristics">
        {/* QR scan — auto-fills NPS / schedule / fluid from a pipe tag (native only) */}
        <QRScanButton
          onResult={handleQRResult}
          label="Scan Pipe Tag"
          variant="ghost"
          className="w-full justify-center mb-2"
        />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Pipe Size (NPS)"><Select value={nps} onChange={setNps} options={NPS_SIZES} /></Field>
          <Field label="Schedule"><Select value={schedule} onChange={setSchedule} options={SCHEDULES} /></Field>
          <Field label="Standard">
            <Select value={standard} onChange={setStandard} options={["B36.10M","B36.19M"]} />
          </Field>
          <Field label="Material">
            <Select value={material} onChange={setMaterial} options={MATERIALS} />
          </Field>
          <Field label="Fluid Service"><Select value={fluid} onChange={setFluid} options={FLUIDS} /></Field>
          <Field label="Insulation Thickness (in)">
            <Select
              value={String(tIns)}
              onChange={v => setTIns(parseFloat(v))}
              options={INSULATION_THICKNESSES.map(String)}
            />
          </Field>
          <Field label="Insulation Density (lb/ft³)" hint="Default: 5.0 lb/ft³">
            <NumberInput value={insDensity} onChange={setInsDensity} min={0} />
          </Field>
        </div>
      </SectionCard>

      {/* Support Type */}
      <SectionCard title="D. Support Type">
        <div className="flex flex-wrap gap-2">
          {SUPPORT_TYPES.map(t => (
            <SupportTypeBtn key={t} label={t} active={supportType === t} onClick={() => setSupportType(t)} />
          ))}
        </div>
      </SectionCard>

      {/* Design Basis */}
      <SectionCard title="E. Design Basis">
        <div className="flex gap-3">
          {DESIGN_BASES.map(b => (
            <PhaseButton key={b} label={`ASME ${b}`} active={designBasis === b} onClick={() => setDesignBasis(b)} />
          ))}
        </div>
        <p className="text-xs text-gray-500 pt-1">
          Code selection influences engineering assumptions and project documentation.
          Support spacing remains configurable per company standards.
        </p>
      </SectionCard>

      {/* Drainage / Slope */}
      <SectionCard title="F. Drainage / Slope Control">
        <div className="flex gap-3 mb-3">
          <PhaseButton label="Fixed Slope" active={slopeMode === "fixed"} onClick={() => setSlopeMode("fixed")} />
          <PhaseButton label="Deflection-Controlled Drainage" active={slopeMode === "deflection"} onClick={() => setSlopeMode("deflection")} />
        </div>
        {slopeMode === "fixed" && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Slope (in/ft)">
              <select
                value={slopeValue}
                onChange={e => setSlopeValue(parseFloat(e.target.value))}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-orange-500 focus:outline-none"
              >
                <option value={1/16}>1/16" per ft</option>
                <option value={1/8}>1/8" per ft</option>
                <option value={1/4}>1/4" per ft</option>
                <option value={-1}>Custom</option>
              </select>
            </Field>
            {slopeValue === -1 && (
              <Field label="Custom Slope (in/ft)">
                <NumberInput value="" onChange={setSlopeValue} min={0} step={0.001} />
              </Field>
            )}
          </div>
        )}
      </SectionCard>

      {/* Advanced Parameters */}
      <SectionCard title="Advanced Parameters">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Allowable Deflection (in)"
            hint="Engineering criterion — not a universal ASME code requirement">
            <NumberInput value={deflection} onChange={setDeflection} min={0.01} max={1.0} step={0.01} />
          </Field>
          <Field label="Weld Clearance (in)">
            <NumberInput value={clearanceIn} onChange={setClearanceIn} min={0} />
          </Field>
          <Field label="Company Std Span (ft)" hint="Optional — overrides recommended span if smaller">
            <NumberInput value={spanCompany} onChange={setSpanCompany} min={1} />
          </Field>
          <Field label="Weld Locations (ft)" hint="Comma-separated: 7.5, 22.5, 45.0">
            <input
              type="text"
              value={weldLocs}
              onChange={e => setWeldLocs(e.target.value)}
              placeholder="e.g. 7.5, 22.5, 45.0"
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-orange-500 focus:outline-none"
            />
          </Field>
          <Field label="Support Locations (ft)" hint="Comma-separated for weld clearance check">
            <input
              type="text"
              value={supLocs}
              onChange={e => setSupLocs(e.target.value)}
              placeholder="e.g. 0, 15.0, 30.0"
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-orange-500 focus:outline-none"
            />
          </Field>
          <Field label="Hydrotest Mode">
            <button
              type="button"
              onClick={() => setHydrotest(!hydrotest)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                hydrotest ? "bg-blue-600 text-white" : "border border-gray-700 text-gray-400"
              }`}
            >
              {hydrotest ? "Enabled" : "Disabled"}
            </button>
          </Field>
        </div>
      </SectionCard>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
      >
        {loading ? "Calculating…" : "Run Pipe Support Calculation"}
      </button>
    </form>
  );
}
