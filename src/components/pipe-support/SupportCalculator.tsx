"use client";

import { useState } from "react";
import { Wifi, WifiOff, Save, CheckCircle } from "lucide-react";
import InputForm from "./InputForm";
import OutputScreen from "./OutputScreen";
import { SaveCalculationModal } from "./SaveCalculationModal";
import { useOfflineCalc } from "@/hooks/useOfflineCalc";
import { useProjectsList } from "@/hooks/useProjects";

export type CalcResult = {
  dimensions: { OD_in: number; wall_in: number; ID_in: number };
  areas: { metal_area_in2: number; fluid_area_in2: number; insulation_area_in2: number };
  weights: { metal_lbft: number; fluid_lbft: number; insulation_lbft: number; total_lbft: number };
  span: {
    calculated_ft: number; recommended_ft: number;
    company_ft?: number; selected_ft: number;
    moment_of_inertia_in4: number; elastic_modulus_psi: number;
  };
  slope: { drop_decimal_in?: number; drop_fraction_str?: string; min_slope_in_per_ft?: number };
  hydrotest: {
    W_water_lbft: number; W_test_lbft: number;
    P_test_lb: number; operating_load_lb: number; percent_increase: number;
  };
  weld_clearance: {
    pass: boolean;
    conflicts: Array<{ original_ft: number; weld_ft: number; gap_in: number; shifted_by_in: number; adjusted_to_ft: number }>;
    adjusted_locations_ft: number[];
    audit_entries: string[];
  };
  turnaround?: {
    shim_thickness_in: number; shim_fraction_str: string;
    remaining_travel_after_shim_in: number; thermal_growth_allowance_in: number;
    slot_travel_warning: boolean; warning_message: string;
  };
};

export default function SupportCalculator() {
  const [result, setResult]             = useState<CalcResult | null>(null);
  const [inputs, setInputs]             = useState<Record<string, unknown>>({});
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [saveOpen, setSaveOpen]         = useState(false);
  const [savedId, setSavedId]           = useState<string | null>(null);
  const { calculate, loading, error, usedOffline, networkStatus } = useOfflineCalc();
  const { data: projects = [] } = useProjectsList();

  const handleCalculate = async (formData: Record<string, unknown>) => {
    setInputs(formData);
    setSavedId(null);
    const data = await calculate(formData);
    if (data) setResult(data);
  };

  return (
    <div className="text-gray-100 space-y-6">
      {/* ── Network status banner ── */}
      <div className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs border ${
        networkStatus === 'offline'
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          : 'bg-surface-800/50 border-surface-700 text-surface-500'
      }`}>
        {networkStatus === 'offline'
          ? <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
          : <Wifi    className="w-3.5 h-3.5 flex-shrink-0" />}
        {networkStatus === 'offline'
          ? 'Offline mode — calculations run locally. Weld clearance check requires connectivity.'
          : 'Connected — calculations are server-validated.'}
      </div>

      {/* ── Offline result banner ── */}
      {usedOffline && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
          <strong>OFFLINE RESULT:</strong> This calculation ran on-device without server validation.
          Re-run when connected to confirm weld clearance and slope details.
        </div>
      )}

      {/* ── Engineering Notice ── */}
      <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-xs text-orange-300">
        <strong>ENGINEERING NOTICE:</strong> This tool supplements engineering judgment and field execution.
        It does not replace Professional Engineering review where required by code, regulation, or project specification.
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {!result ? (
        <InputForm
          onCalculate={handleCalculate}
          loading={loading}
          projects={projects}
          selectedProject={selectedProject}
          onProjectChange={setSelectedProject}
        />
      ) : (
        <>
          <OutputScreen
            result={result}
            inputs={inputs}
            savedId={savedId}
          />

          {/* Action row */}
          <div className="flex flex-wrap gap-3 mt-2">
            <button
              onClick={() => { setResult(null); setSavedId(null); }}
              className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-400 hover:border-orange-500 hover:text-orange-400 transition-colors"
            >
              ← New Calculation
            </button>

            {savedId ? (
              <span className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-green-400 border border-green-500/30 bg-green-500/10">
                <CheckCircle className="w-4 h-4" /> Saved
              </span>
            ) : (
              <button
                onClick={() => setSaveOpen(true)}
                className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
              >
                <Save className="w-4 h-4" /> Save Calculation
              </button>
            )}
          </div>
        </>
      )}

      <SaveCalculationModal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        onSaved={(id) => setSavedId(id)}
        inputs={inputs}
        result={result ?? {}}
        projects={projects}
        defaultProjectId={selectedProject || null}
      />
    </div>
  );
}
