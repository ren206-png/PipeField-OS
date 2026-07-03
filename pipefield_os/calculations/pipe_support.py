"""
PipeField OS — Pipe Support Engineering Calculations
All formulas per ASME B31.1 / B31.3 engineering principles.
CRITICAL: Pipe dimensions loaded from ASME table only. Never hardcoded.
"""

import json
import math
from pathlib import Path
from typing import Optional

# ──────────────────────────────────────────────────────────────────────────────
# Data file paths
# ──────────────────────────────────────────────────────────────────────────────
_DATA_DIR = Path(__file__).parent.parent / "data"
_ASME_DIMS_PATH = _DATA_DIR / "asme_pipe_dimensions.json"
_ROD_CAP_PATH = _DATA_DIR / "rod_capacity_table.json"

def _load_asme_dims() -> dict:
    with open(_ASME_DIMS_PATH) as f:
        return json.load(f)

def _load_rod_capacities() -> list[dict]:
    with open(_ROD_CAP_PATH) as f:
        return json.load(f)["rod_capacities"]

# ──────────────────────────────────────────────────────────────────────────────
# Material / fluid constants
# ──────────────────────────────────────────────────────────────────────────────
MATERIAL_DENSITY_LBIN3: dict[str, float] = {
    "carbon_steel":    0.2833,
    "stainless_steel": 0.2900,
    "copper":          0.3240,
}

MATERIAL_ELASTIC_MODULUS_PSI: dict[str, float] = {
    "carbon_steel":    29_000_000.0,
    "stainless_steel": 28_000_000.0,
    "copper":          17_000_000.0,
}

FLUID_DENSITY_LBFT3: dict[str, float] = {
    "water":       62.4,
    "steam":        0.0373,
    "condensate":  62.0,
    "air":          0.0765,
    "nitrogen":     0.0725,
    "natural_gas":  0.0496,
    "crude_oil":   55.0,
}

# ──────────────────────────────────────────────────────────────────────────────
# Helper: decimal inches → fractional string (nearest 1/16")
# ──────────────────────────────────────────────────────────────────────────────
def _to_fraction_str(value_in: float) -> str:
    """Return a fractional inch string rounded to nearest 1/16\". E.g. '3-5/16\"'."""
    whole = int(value_in)
    frac_16 = round((value_in - whole) * 16)
    if frac_16 == 16:
        whole += 1
        frac_16 = 0
    if frac_16 == 0:
        return f'{whole}"'
    # Reduce fraction
    from math import gcd
    g = gcd(frac_16, 16)
    num, den = frac_16 // g, 16 // g
    if whole == 0:
        return f'{num}/{den}"'
    return f'{whole}-{num}/{den}"'


# ──────────────────────────────────────────────────────────────────────────────
# Section 1 — Pipe Dimension Loader
# ──────────────────────────────────────────────────────────────────────────────
def get_pipe_dimensions(nps: str, schedule: str, standard: str = "B36.10M") -> dict:
    """
    Load OD, wall thickness, and ID from ASME dimension table.

    Args:
        nps: Nominal pipe size string, e.g. "4.0", "12.0"
        schedule: Schedule string, e.g. "SCH40", "STD", "XS", "SCH80S"
        standard: "B36.10M" (carbon steel) or "B36.19M" (stainless)

    Returns:
        {"OD_in": float, "wall_in": float, "ID_in": float}

    Raises:
        ValueError: if NPS or schedule not found in table.
    """
    dims = _load_asme_dims()
    if standard not in dims:
        raise ValueError(f"Standard '{standard}' not found. Use 'B36.10M' or 'B36.19M'.")
    std_data = dims[standard]
    if nps not in std_data:
        available = list(std_data.keys())
        raise ValueError(f"NPS '{nps}' not found in {standard}. Available: {available}")
    nps_data = std_data[nps]
    schedules = nps_data["schedules"]
    if schedule not in schedules:
        available = list(schedules.keys())
        raise ValueError(
            f"Schedule '{schedule}' not found for NPS {nps} in {standard}. "
            f"Available: {available}"
        )
    sch = schedules[schedule]
    return {
        "OD_in":   nps_data["OD_in"],
        "wall_in": sch["wall_in"],
        "ID_in":   sch["ID_in"],
    }


# ──────────────────────────────────────────────────────────────────────────────
# Section 2 — Pipe Metal Area
# ──────────────────────────────────────────────────────────────────────────────
def calc_metal_area(OD_in: float, ID_in: float) -> float:
    """
    Calculate pipe metal cross-sectional area.

    Formula: A_m = (π/4)(D_o² − D_i²)

    Args:
        OD_in: Outside diameter in inches
        ID_in: Inside diameter in inches

    Returns:
        Metal area in in²
    """
    return (math.pi / 4) * (OD_in ** 2 - ID_in ** 2)


# ──────────────────────────────────────────────────────────────────────────────
# Section 3 — Fluid Flow Area
# ──────────────────────────────────────────────────────────────────────────────
def calc_fluid_area(ID_in: float) -> float:
    """
    Calculate internal fluid flow area.

    Formula: A_f = (π/4)(D_i²)

    Args:
        ID_in: Inside diameter in inches

    Returns:
        Fluid area in in²
    """
    return (math.pi / 4) * (ID_in ** 2)


# ──────────────────────────────────────────────────────────────────────────────
# Section 4 — Insulation Area
# ──────────────────────────────────────────────────────────────────────────────
def calc_insulation_area(OD_in: float, t_ins_in: float) -> float:
    """
    Calculate insulation cross-sectional area.

    Formula: A_ins = (π/4)[(D_o + 2·t_ins)² − D_o²]

    Args:
        OD_in:    Outside diameter of pipe in inches
        t_ins_in: Insulation thickness in inches (0 = no insulation)

    Returns:
        Insulation area in in²
    """
    if t_ins_in <= 0:
        return 0.0
    return (math.pi / 4) * ((OD_in + 2 * t_ins_in) ** 2 - OD_in ** 2)


# ──────────────────────────────────────────────────────────────────────────────
# Section 5 — Metal Weight Per Foot
# ──────────────────────────────────────────────────────────────────────────────
def calc_metal_weight_per_foot(A_m_in2: float, material: str) -> float:
    """
    Calculate pipe metal weight per linear foot.

    Formula: W_m = A_m × 12 × ρ_m
    NOTE: Unit conversion — ρ in lb/in³, multiply by 12 in/ft gives lb/ft.

    Args:
        A_m_in2: Metal cross-sectional area in in²
        material: One of "carbon_steel", "stainless_steel", "copper"

    Returns:
        Metal weight in lb/ft

    Raises:
        ValueError: if material not recognized
    """
    material_key = material.lower().replace(" ", "_")
    if material_key not in MATERIAL_DENSITY_LBIN3:
        raise ValueError(
            f"Material '{material}' not recognized. "
            f"Valid options: {list(MATERIAL_DENSITY_LBIN3.keys())}"
        )
    rho = MATERIAL_DENSITY_LBIN3[material_key]
    return A_m_in2 * 12.0 * rho


# ──────────────────────────────────────────────────────────────────────────────
# Section 6 — Fluid Weight Per Foot
# ──────────────────────────────────────────────────────────────────────────────
def calc_fluid_weight_per_foot(
    A_f_in2: float,
    fluid: str,
    custom_density_lbft3: Optional[float] = None,
) -> float:
    """
    Calculate fluid weight per linear foot.

    Formula: W_f = A_f × 12 × ρ_f
    NOTE: Unit conversion — ρ (lb/ft³) ÷ 1728 = ρ (lb/in³); × 12 in/ft → lb/ft

    Args:
        A_f_in2:             Fluid cross-sectional area in in²
        fluid:               Fluid type string (e.g. "water", "steam")
        custom_density_lbft3: Override density in lb/ft³ (used when fluid="custom")

    Returns:
        Fluid weight in lb/ft
    """
    fluid_key = fluid.lower().replace(" ", "_")
    if custom_density_lbft3 is not None:
        density_lbft3 = custom_density_lbft3
    elif fluid_key in FLUID_DENSITY_LBFT3:
        density_lbft3 = FLUID_DENSITY_LBFT3[fluid_key]
    else:
        raise ValueError(
            f"Fluid '{fluid}' not recognized and no custom density provided. "
            f"Valid: {list(FLUID_DENSITY_LBFT3.keys())} or set custom_density_lbft3."
        )
    # Convert lb/ft³ → lb/in³
    density_lbin3 = density_lbft3 / 1728.0
    return A_f_in2 * 12.0 * density_lbin3


# ──────────────────────────────────────────────────────────────────────────────
# Section 7 — Insulation Weight Per Foot
# ──────────────────────────────────────────────────────────────────────────────
def calc_insulation_weight_per_foot(
    A_ins_in2: float,
    density_lbft3: float = 5.0,
) -> float:
    """
    Calculate insulation weight per linear foot.

    Formula: W_ins = A_ins × 12 × ρ_ins
    NOTE: Unit conversion — ρ (lb/ft³) ÷ 1728 = ρ (lb/in³)

    Args:
        A_ins_in2:    Insulation cross-sectional area in in²
        density_lbft3: Insulation density in lb/ft³ (default 5.0)

    Returns:
        Insulation weight in lb/ft
    """
    density_lbin3 = density_lbft3 / 1728.0
    return A_ins_in2 * 12.0 * density_lbin3


# ──────────────────────────────────────────────────────────────────────────────
# Section 8 — Total Operating Weight
# ──────────────────────────────────────────────────────────────────────────────
def calc_total_operating_weight(W_m: float, W_f: float, W_ins: float) -> float:
    """
    Sum total operating weight per foot.

    Formula: W_total = W_m + W_f + W_ins

    Args:
        W_m:   Metal weight (lb/ft)
        W_f:   Fluid weight (lb/ft)
        W_ins: Insulation weight (lb/ft)

    Returns:
        Total operating weight in lb/ft
    """
    return W_m + W_f + W_ins


# ──────────────────────────────────────────────────────────────────────────────
# Section 9 — Support Span (Beam Deflection)
# ──────────────────────────────────────────────────────────────────────────────
def calc_support_span(
    OD_in: float,
    ID_in: float,
    W_total_lbft: float,
    material: str,
    deflection_allow_in: float = 0.10,
) -> dict:
    """
    Calculate maximum allowable support span using simply-supported beam deflection.

    Formula:
        δ = (5 × w × L⁴) / (384 × E × I)
        Solved for L:
        L = [ (δ_allow × 384 × E × I) / (5 × w) ]^(1/4)

    Where:
        w = load per unit length (lb/in)  ← W_total_lbft ÷ 12
        E = elastic modulus (lb/in²)
        I = moment of inertia (in⁴) = (π/64)(D_o⁴ − D_i⁴)

    UI Notice: Allowable deflection of 0.10\" is an engineering design criterion,
               not a universal ASME code requirement.

    Args:
        OD_in:              Outside diameter in inches
        ID_in:              Inside diameter in inches
        W_total_lbft:       Total operating weight in lb/ft
        material:           Pipe material string
        deflection_allow_in: Allowable mid-span deflection in inches (default 0.10)

    Returns:
        {
            "span_calculated_ft":     float,   # exact calculated span
            "span_recommended_ft":    float,   # rounded down to nearest 0.5 ft
            "moment_of_inertia_in4":  float,
            "elastic_modulus_psi":    float,
        }
    """
    material_key = material.lower().replace(" ", "_")
    if material_key not in MATERIAL_ELASTIC_MODULUS_PSI:
        raise ValueError(f"Material '{material}' not recognized for elastic modulus.")
    E = MATERIAL_ELASTIC_MODULUS_PSI[material_key]

    # Moment of inertia: I = (π/64)(D_o⁴ − D_i⁴)
    I = (math.pi / 64) * (OD_in ** 4 - ID_in ** 4)

    # Convert load to lb/in
    w = W_total_lbft / 12.0

    if w <= 0:
        raise ValueError("Total weight W_total_lbft must be > 0.")

    # L in inches
    L_in = ((deflection_allow_in * 384 * E * I) / (5 * w)) ** 0.25

    # Convert to feet
    span_calc_ft = L_in / 12.0

    # Round down to nearest 0.5 ft
    span_rec_ft = math.floor(span_calc_ft * 2) / 2.0

    return {
        "span_calculated_ft":    round(span_calc_ft, 2),
        "span_recommended_ft":   span_rec_ft,
        "moment_of_inertia_in4": round(I, 6),
        "elastic_modulus_psi":   E,
    }


# ──────────────────────────────────────────────────────────────────────────────
# Section 10 — Slope Calculations
# ──────────────────────────────────────────────────────────────────────────────
def calc_fixed_slope_drop(slope_in_per_ft: float, run_length_ft: float) -> dict:
    """
    Calculate elevation drop for a fixed drainage slope.

    Formula: Drop (in) = Slope (in/ft) × Run Length (ft)

    Args:
        slope_in_per_ft: Slope in inches per foot (e.g. 0.125 for 1/8" per ft)
        run_length_ft:   Horizontal run length in feet

    Returns:
        {
            "drop_decimal_in": float,
            "drop_fraction_str": str,  # e.g. '3-5/16"'
        }
    """
    drop = slope_in_per_ft * run_length_ft
    return {
        "drop_decimal_in":  round(drop, 4),
        "drop_fraction_str": _to_fraction_str(drop),
    }


def calc_minimum_slope_for_drainage(span_ft: float, deflection_in: float) -> float:
    """
    Calculate minimum required slope to prevent liquid pocketing.

    The beam deflects parabolically; to drain, the slope must exceed the
    midspan deflection over half the span.

    Formula: min_slope (in/ft) = (2 × deflection_in) / (span_ft / 2)
                               = 4 × deflection_in / span_ft

    Args:
        span_ft:       Support span in feet
        deflection_in: Calculated mid-span deflection in inches

    Returns:
        Minimum slope in inches per foot
    """
    if span_ft <= 0:
        raise ValueError("span_ft must be > 0")
    return (4.0 * deflection_in) / span_ft


# ──────────────────────────────────────────────────────────────────────────────
# Section 11 — Hydrotest Load
# ──────────────────────────────────────────────────────────────────────────────
def calc_hydrotest_load(
    W_m: float,
    W_ins: float,
    OD_in: float,
    ID_in: float,
    span_ft: float,
    W_operating_lbft: Optional[float] = None,
) -> dict:
    """
    Calculate hydrotest load per support.

    Hydrotest always uses water density (62.4 lb/ft³) regardless of fluid service.

    Formula:
        W_water = A_f × 12 × (62.4 / 1728)
        W_test  = W_m + W_ins + W_water
        P_test  = W_test × span_ft

    Args:
        W_m:               Metal weight (lb/ft)
        W_ins:             Insulation weight (lb/ft)
        OD_in:             Outside diameter (in)
        ID_in:             Inside diameter (in)
        span_ft:           Support span (ft)
        W_operating_lbft:  Total operating weight (lb/ft) for comparison (optional)

    Returns:
        {
            "W_water_lbft":       float,
            "W_test_lbft":        float,
            "P_test_lb":          float,
            "operating_load_lb":  float,
            "percent_increase":   float,
        }
    """
    A_f = calc_fluid_area(ID_in)
    W_water = calc_fluid_weight_per_foot(A_f, "water")
    W_test = W_m + W_ins + W_water
    P_test = W_test * span_ft
    op_load = (W_operating_lbft * span_ft) if W_operating_lbft else (W_test * span_ft)
    pct_increase = ((P_test - op_load) / op_load * 100) if op_load > 0 else 0.0
    return {
        "W_water_lbft":      round(W_water, 4),
        "W_test_lbft":       round(W_test, 4),
        "P_test_lb":         round(P_test, 2),
        "operating_load_lb": round(op_load, 2),
        "percent_increase":  round(pct_increase, 1),
    }


# ──────────────────────────────────────────────────────────────────────────────
# Section 12 — Weld Clearance Engine
# ──────────────────────────────────────────────────────────────────────────────
def check_weld_clearance(
    support_locations_ft: list[float],
    weld_locations_ft: list[float],
    clearance_in: float = 2.0,
) -> dict:
    """
    Verify minimum clearance between support locations and weld locations.
    Shifts conflicting supports away from the weld.

    Args:
        support_locations_ft: List of support center locations in feet
        weld_locations_ft:    List of weld center locations in feet
        clearance_in:         Minimum required clearance in inches (default 2.0)

    Returns:
        {
            "pass":                 bool,
            "conflicts":            list[dict],   # {support_ft, weld_ft, gap_in, shifted_by_in}
            "adjusted_locations_ft": list[float],
            "audit_entries":        list[str],
        }
    """
    clearance_ft = clearance_in / 12.0
    adjusted = list(support_locations_ft)
    conflicts = []
    audit_entries = []

    for i, sup_ft in enumerate(adjusted):
        for weld_ft in weld_locations_ft:
            gap_ft = abs(sup_ft - weld_ft)
            if gap_ft < clearance_ft:
                gap_in = gap_ft * 12.0
                # Shift support away from weld
                direction = 1 if sup_ft >= weld_ft else -1
                shift_ft = clearance_ft - gap_ft
                shift_in = shift_ft * 12.0
                new_loc = sup_ft + direction * shift_ft
                adjusted[i] = round(new_loc, 4)
                conflicts.append({
                    "support_index":    i,
                    "original_ft":      sup_ft,
                    "weld_ft":          weld_ft,
                    "gap_in":           round(gap_in, 3),
                    "shifted_by_in":    round(shift_in, 3),
                    "adjusted_to_ft":   round(new_loc, 4),
                })
                audit_entries.append(
                    f"Support at {sup_ft:.2f} ft shifted {shift_in:.3f}\" "
                    f"due to weld clearance conflict at weld {weld_ft:.2f} ft"
                )

    return {
        "pass":                  len(conflicts) == 0,
        "conflicts":             conflicts,
        "adjusted_locations_ft": adjusted,
        "audit_entries":         audit_entries,
    }


# ──────────────────────────────────────────────────────────────────────────────
# Section 13 — Thread Capacity Verification
# ──────────────────────────────────────────────────────────────────────────────
def verify_rod_capacity(
    load_lb: float,
    rod_diameter_in: float,
    safety_factor: float = 3.0,
) -> dict:
    """
    Verify threaded rod tensile capacity against applied load.

    Formula:
        A_t = 0.7854 × (D − 0.9743/n)²
        Check: load_lb × safety_factor ≤ allowable_load_lb

    Args:
        load_lb:         Applied load in pounds
        rod_diameter_in: Rod nominal diameter in inches
        safety_factor:   Design safety factor (default 3.0)

    Returns:
        {
            "pass":                     bool,
            "rod_diameter_str":         str,
            "A_t_in2":                  float,
            "allowable_load_lb":        float,
            "applied_load_with_sf_lb":  float,
            "utilization_pct":          float,
        }

    Raises:
        ValueError: if rod diameter not found in table
    """
    capacities = _load_rod_capacities()
    rod = next((r for r in capacities if abs(r["diameter_in"] - rod_diameter_in) < 1e-4), None)
    if rod is None:
        available = [r["diameter_in"] for r in capacities]
        raise ValueError(
            f"Rod diameter {rod_diameter_in}\" not found in rod capacity table. "
            f"Available: {available}"
        )

    n = rod["threads_per_inch"]
    D = rod_diameter_in
    A_t = 0.7854 * (D - 0.9743 / n) ** 2

    allowable = rod["allowable_load_lb"]
    applied_with_sf = load_lb * safety_factor
    utilization = (applied_with_sf / allowable) * 100.0

    return {
        "pass":                    applied_with_sf <= allowable,
        "rod_diameter_str":        rod["diameter_str"],
        "A_t_in2":                 round(A_t, 6),
        "allowable_load_lb":       allowable,
        "applied_load_with_sf_lb": round(applied_with_sf, 2),
        "utilization_pct":         round(utilization, 1),
    }


# ──────────────────────────────────────────────────────────────────────────────
# Section 14 — Turnaround Remediation
# ──────────────────────────────────────────────────────────────────────────────
def calc_turnaround_remediation(
    existing_sag_in: float,
    existing_support_elevation_in: float,
    remaining_slot_travel_in: float,
    thermal_growth_in: float,
    span_ft: float,
    W_total_lbft: float,
    material: str,
    OD_in: float,
    ID_in: float,
    min_remaining_travel_in: float = 0.5,
) -> dict:
    """
    Calculate shim pack thickness and verify slot travel for turnaround remediation.

    The shim corrects existing sag and restores pipe to required elevation,
    while preserving thermal growth allowance in the slot.

    Args:
        existing_sag_in:               Measured sag at midspan (inches)
        existing_support_elevation_in: Current support elevation (inches)
        remaining_slot_travel_in:      Available slot travel remaining (inches)
        thermal_growth_in:             Expected thermal growth (inches)
        span_ft:                       Support span (feet)
        W_total_lbft:                  Total operating weight (lb/ft)
        material:                      Pipe material string
        OD_in:                         Outside diameter (inches)
        ID_in:                         Inside diameter (inches)
        min_remaining_travel_in:       Minimum acceptable remaining travel (default 0.5\")

    Returns:
        {
            "shim_thickness_in":          float,
            "shim_fraction_str":          str,
            "remaining_travel_after_shim_in": float,
            "thermal_growth_allowance_in":    float,
            "slot_travel_warning":            bool,
            "warning_message":                str,
        }
    """
    # Shim must restore sag + provide thermal growth allowance
    shim_in = existing_sag_in + thermal_growth_in
    remaining_after = remaining_slot_travel_in - shim_in
    warning = remaining_after < min_remaining_travel_in

    msg = ""
    if warning:
        msg = (
            f"WARNING: Only {remaining_after:.3f}\" slot travel remaining after "
            f"shim installation (minimum required: {min_remaining_travel_in}\"). "
            f"Consider alternative support or reroute."
        )

    return {
        "shim_thickness_in":              round(shim_in, 4),
        "shim_fraction_str":              _to_fraction_str(shim_in),
        "remaining_travel_after_shim_in": round(remaining_after, 4),
        "thermal_growth_allowance_in":    round(thermal_growth_in, 4),
        "slot_travel_warning":            warning,
        "warning_message":                msg,
    }


# ──────────────────────────────────────────────────────────────────────────────
# Section 15 — Rod Cut-Sheet Generator
# ──────────────────────────────────────────────────────────────────────────────
def generate_rod_cutsheet(
    support_type: str,
    pipe_elevation_in: float,
    structure_elevation_in: float,
    rod_diameter_in: float,
    manufacturer_dims: dict,
) -> dict:
    """
    Generate fabrication cut lengths for threaded hanger rods.

    manufacturer_dims keys (all in inches):
        - "hanger_height_in":    clevis/hanger body height
        - "nut_height_in":       hex nut height
        - "thread_engagement_in": thread engagement per end (default 1.5× diameter)
        - "rod_quantity":         number of rods (default 1)

    Args:
        support_type:         e.g. "clevis_hanger", "trapeze", "pipe_shoe"
        pipe_elevation_in:    Bottom of pipe elevation (inches)
        structure_elevation_in: Attachment point elevation (inches)
        rod_diameter_in:      Rod nominal diameter (inches)
        manufacturer_dims:    Dict with hanger body dimensions

    Returns:
        {
            "rod_diameter_in":          float,
            "rod_quantity":             int,
            "gross_length_in":          float,
            "thread_allowance_in":      float,
            "exposed_thread_in":        float,
            "fabrication_cut_length_in": float,
            "fabrication_cut_length_str": str,
        }
    """
    hanger_h = manufacturer_dims.get("hanger_height_in", 0.0)
    nut_h = manufacturer_dims.get("nut_height_in", rod_diameter_in * 0.9)
    thread_eng = manufacturer_dims.get("thread_engagement_in", 1.5 * rod_diameter_in)
    qty = manufacturer_dims.get("rod_quantity", 1)

    # Gross length = total vertical distance minus hardware
    gross = abs(structure_elevation_in - pipe_elevation_in) - hanger_h

    # Thread allowance = engagement at both ends
    thread_allow = thread_eng * 2

    # Exposed thread (visible outside nut)
    exposed_thread = nut_h

    # Fabrication cut length
    cut_length = gross + thread_allow + exposed_thread

    return {
        "rod_diameter_in":           rod_diameter_in,
        "rod_quantity":              int(qty),
        "gross_length_in":           round(gross, 4),
        "thread_allowance_in":       round(thread_allow, 4),
        "exposed_thread_in":         round(exposed_thread, 4),
        "fabrication_cut_length_in": round(cut_length, 4),
        "fabrication_cut_length_str": _to_fraction_str(cut_length),
    }


# ──────────────────────────────────────────────────────────────────────────────
# Section 16 — Maintenance Access & Interference Engine
# ──────────────────────────────────────────────────────────────────────────────
def check_access_interference(
    support_location_ft: float,
    access_zones: list[dict],
    clearance_ft: float = 3.0,
) -> dict:
    """
    Check support location against maintenance access zones.

    access_zones items: {"type": str, "center_ft": float, "radius_ft": float}

    Resolution options if conflict detected:
        1. Relocate support (shift beyond clearance zone)
        2. Rotate support orientation
        3. Recommend alternate support type

    Args:
        support_location_ft: Support centerline location (ft)
        access_zones:        List of access zone dicts
        clearance_ft:        Minimum clearance from access zone (default 3.0)

    Returns:
        {
            "conflict":          bool,
            "conflicts":         list[dict],
            "resolution_options": list[str],
        }
    """
    conflicts = []
    for zone in access_zones:
        center = zone["center_ft"]
        radius = zone.get("radius_ft", 1.0)
        zone_type = zone.get("type", "unknown")
        # Support conflicts if it's within (radius + clearance) of zone center
        dist = abs(support_location_ft - center)
        required_gap = radius + clearance_ft
        if dist < required_gap:
            conflicts.append({
                "zone_type":     zone_type,
                "zone_center_ft": center,
                "zone_radius_ft": radius,
                "actual_gap_ft":  round(dist, 3),
                "required_gap_ft": round(required_gap, 3),
            })

    options = []
    if conflicts:
        options = [
            "Option 1: Relocate support to clear access zone",
            "Option 2: Rotate support orientation 90°",
            "Option 3: Use alternate support type (e.g., trunnion → pipe shoe)",
        ]

    return {
        "conflict":           len(conflicts) > 0,
        "conflicts":          conflicts,
        "resolution_options": options,
    }


# ──────────────────────────────────────────────────────────────────────────────
# Full Support Calculation — Orchestrator
# ──────────────────────────────────────────────────────────────────────────────
def run_full_support_calculation(params: dict) -> dict:
    """
    Orchestrate a complete pipe support calculation.

    params keys:
        nps, schedule, standard, material, fluid, insulation_thickness_in,
        insulation_density_lbft3, deflection_allow_in, slope_mode, slope_value,
        slope_run_length_ft, span_company_ft, hydrotest_mode, project_phase,
        weld_locations_ft, support_locations_ft, clearance_in,
        custom_fluid_density_lbft3, access_zones

    Returns full output dict matching all output screen sections.
    """
    nps = params["nps"]
    schedule = params["schedule"]
    standard = params.get("standard", "B36.10M")
    material = params["material"]
    fluid = params.get("fluid", "water")
    t_ins = params.get("insulation_thickness_in", 0.0)
    ins_density = params.get("insulation_density_lbft3", 5.0)
    deflection = params.get("deflection_allow_in", 0.10)
    custom_density = params.get("custom_fluid_density_lbft3")

    # Dimensions
    dims = get_pipe_dimensions(nps, schedule, standard)
    OD, ID_ = dims["OD_in"], dims["ID_in"]

    # Areas
    A_m = calc_metal_area(OD, ID_)
    A_f = calc_fluid_area(ID_)
    A_ins = calc_insulation_area(OD, t_ins)

    # Weights
    W_m = calc_metal_weight_per_foot(A_m, material)
    W_f = calc_fluid_weight_per_foot(A_f, fluid, custom_density)
    W_ins = calc_insulation_weight_per_foot(A_ins, ins_density)
    W_total = calc_total_operating_weight(W_m, W_f, W_ins)

    # Span
    span_result = calc_support_span(OD, ID_, W_total, material, deflection)
    span_calc = span_result["span_calculated_ft"]
    span_rec = span_result["span_recommended_ft"]
    span_company = params.get("span_company_ft", span_rec)
    span_selected = min(span_rec, span_company)

    # Slope
    slope_mode = params.get("slope_mode", "fixed")
    slope_val = params.get("slope_value", 0.125)
    run_ft = params.get("slope_run_length_ft", span_selected)
    if slope_mode == "fixed":
        slope_report = calc_fixed_slope_drop(slope_val, run_ft)
    else:
        min_slope = calc_minimum_slope_for_drainage(span_selected, deflection)
        slope_report = {
            "min_slope_in_per_ft": min_slope,
            "drop_decimal_in": min_slope * span_selected,
            "drop_fraction_str": _to_fraction_str(min_slope * span_selected),
        }

    # Hydrotest
    hydrotest_result = calc_hydrotest_load(W_m, W_ins, OD, ID_, span_selected, W_total)

    # Weld clearance
    sup_locs = params.get("support_locations_ft", [])
    weld_locs = params.get("weld_locations_ft", [])
    clearance_in = params.get("clearance_in", 2.0)
    weld_result = check_weld_clearance(sup_locs, weld_locs, clearance_in)

    return {
        "dimensions": dims,
        "areas": {
            "metal_area_in2":      round(A_m, 6),
            "fluid_area_in2":      round(A_f, 6),
            "insulation_area_in2": round(A_ins, 6),
        },
        "weights": {
            "metal_lbft":       round(W_m, 4),
            "fluid_lbft":       round(W_f, 4),
            "insulation_lbft":  round(W_ins, 4),
            "total_lbft":       round(W_total, 4),
        },
        "span": {
            "calculated_ft":   span_calc,
            "recommended_ft":  span_rec,
            "company_ft":      span_company,
            "selected_ft":     span_selected,
            "moment_of_inertia_in4": span_result["moment_of_inertia_in4"],
            "elastic_modulus_psi":   span_result["elastic_modulus_psi"],
        },
        "slope": slope_report,
        "hydrotest": hydrotest_result,
        "weld_clearance": weld_result,
    }
