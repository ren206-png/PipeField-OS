"""
PipeField OS — Unit Tests for Pipe Support Calculations
Run with: pytest pipefield_os/tests/ -v
"""

import math
import pytest
from pipefield_os.calculations.pipe_support import (
    get_pipe_dimensions,
    calc_metal_area,
    calc_fluid_area,
    calc_insulation_area,
    calc_metal_weight_per_foot,
    calc_fluid_weight_per_foot,
    calc_insulation_weight_per_foot,
    calc_total_operating_weight,
    calc_support_span,
    calc_fixed_slope_drop,
    calc_minimum_slope_for_drainage,
    calc_hydrotest_load,
    check_weld_clearance,
    verify_rod_capacity,
    calc_turnaround_remediation,
    generate_rod_cutsheet,
    check_access_interference,
    run_full_support_calculation,
    _to_fraction_str,
)

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
def approx(val, rel=1e-3):
    return pytest.approx(val, rel=rel)


# ─────────────────────────────────────────────────────────────────────────────
# Fraction string helper
# ─────────────────────────────────────────────────────────────────────────────
class TestFractionStr:
    def test_whole_number(self):
        assert _to_fraction_str(3.0) == '3"'

    def test_half_inch(self):
        assert _to_fraction_str(0.5) == '1/2"'

    def test_compound(self):
        assert _to_fraction_str(3.3125) == '3-5/16"'

    def test_zero(self):
        assert _to_fraction_str(0.0) == '0"'

    def test_rollover(self):
        # 0.9375 + rounding to 1/16 just below 1" should stay correct
        result = _to_fraction_str(0.9375)
        assert result == '15/16"'


# ─────────────────────────────────────────────────────────────────────────────
# get_pipe_dimensions
# ─────────────────────────────────────────────────────────────────────────────
class TestGetPipeDimensions:
    def test_4inch_sch40(self):
        d = get_pipe_dimensions("4.0", "SCH40", "B36.10M")
        assert d["OD_in"] == approx(4.500)
        assert d["wall_in"] == approx(0.237)
        assert d["ID_in"] == approx(4.026)

    def test_6inch_std(self):
        d = get_pipe_dimensions("6.0", "STD", "B36.10M")
        assert d["OD_in"] == approx(6.625)
        assert d["wall_in"] == approx(0.280)

    def test_stainless_2inch_10s(self):
        d = get_pipe_dimensions("2.0", "SCH10S", "B36.19M")
        assert d["OD_in"] == approx(2.375)
        assert d["wall_in"] == approx(0.109)
        assert d["ID_in"] == approx(2.157)

    def test_max_nps_60(self):
        d = get_pipe_dimensions("60.0", "STD", "B36.10M")
        assert d["OD_in"] == approx(60.0)

    def test_invalid_nps(self):
        with pytest.raises(ValueError, match="NPS"):
            get_pipe_dimensions("99.0", "SCH40", "B36.10M")

    def test_invalid_schedule(self):
        with pytest.raises(ValueError, match="Schedule"):
            get_pipe_dimensions("4.0", "SCH999", "B36.10M")

    def test_invalid_standard(self):
        with pytest.raises(ValueError, match="Standard"):
            get_pipe_dimensions("4.0", "SCH40", "B99")


# ─────────────────────────────────────────────────────────────────────────────
# calc_metal_area
# ─────────────────────────────────────────────────────────────────────────────
class TestCalcMetalArea:
    def test_4inch_sch40(self):
        # OD=4.5, ID=4.026 → A = π/4 × (4.5² - 4.026²)
        expected = (math.pi / 4) * (4.5 ** 2 - 4.026 ** 2)
        assert calc_metal_area(4.5, 4.026) == approx(expected)

    def test_zero_wall(self):
        # OD = ID → zero area
        assert calc_metal_area(4.0, 4.0) == approx(0.0)

    def test_known_value(self):
        # 2" SCH40: OD=2.375, ID=2.067
        # A = π/4 × (2.375² - 2.067²) = π/4 × (5.6406 - 4.2725) = 1.0745 in²
        result = calc_metal_area(2.375, 2.067)
        assert result == approx(1.0745, rel=1e-2)

    def test_large_pipe(self):
        # 24" XS: OD=24.0, ID=23.0
        result = calc_metal_area(24.0, 23.0)
        expected = (math.pi / 4) * (24.0 ** 2 - 23.0 ** 2)
        assert result == approx(expected)


# ─────────────────────────────────────────────────────────────────────────────
# calc_fluid_area
# ─────────────────────────────────────────────────────────────────────────────
class TestCalcFluidArea:
    def test_2inch(self):
        result = calc_fluid_area(2.067)
        expected = (math.pi / 4) * (2.067 ** 2)
        assert result == approx(expected)

    def test_zero_id(self):
        assert calc_fluid_area(0.0) == approx(0.0)

    def test_large_pipe(self):
        result = calc_fluid_area(23.0)
        expected = (math.pi / 4) * 529.0
        assert result == approx(expected)


# ─────────────────────────────────────────────────────────────────────────────
# calc_insulation_area
# ─────────────────────────────────────────────────────────────────────────────
class TestCalcInsulationArea:
    def test_2inch_1in_insulation(self):
        # OD=2.375, t=1.0 → A = π/4 × [(2.375+2)² - 2.375²]
        expected = (math.pi / 4) * ((2.375 + 2.0) ** 2 - 2.375 ** 2)
        assert calc_insulation_area(2.375, 1.0) == approx(expected)

    def test_zero_insulation(self):
        assert calc_insulation_area(4.5, 0.0) == approx(0.0)

    def test_negative_insulation(self):
        assert calc_insulation_area(4.5, -1.0) == approx(0.0)


# ─────────────────────────────────────────────────────────────────────────────
# calc_metal_weight_per_foot
# ─────────────────────────────────────────────────────────────────────────────
class TestCalcMetalWeightPerFoot:
    def test_carbon_steel_4sch40(self):
        # A_m ≈ 3.174 in², ρ=0.2833 → W = 3.174 × 12 × 0.2833 ≈ 10.79 lb/ft
        A_m = calc_metal_area(4.5, 4.026)
        result = calc_metal_weight_per_foot(A_m, "carbon_steel")
        assert result == approx(10.79, rel=2e-2)

    def test_stainless_steel(self):
        A_m = 1.0
        result = calc_metal_weight_per_foot(A_m, "stainless_steel")
        assert result == approx(12 * 0.2900)

    def test_copper(self):
        A_m = 1.0
        result = calc_metal_weight_per_foot(A_m, "copper")
        assert result == approx(12 * 0.3240)

    def test_invalid_material(self):
        with pytest.raises(ValueError, match="Material"):
            calc_metal_weight_per_foot(1.0, "unobtanium")


# ─────────────────────────────────────────────────────────────────────────────
# calc_fluid_weight_per_foot
# ─────────────────────────────────────────────────────────────────────────────
class TestCalcFluidWeightPerFoot:
    def test_water_2inch(self):
        A_f = calc_fluid_area(2.067)
        result = calc_fluid_weight_per_foot(A_f, "water")
        expected = A_f * 12.0 * (62.4 / 1728.0)
        assert result == approx(expected)

    def test_steam_very_light(self):
        A_f = calc_fluid_area(4.026)
        result = calc_fluid_weight_per_foot(A_f, "steam")
        assert result < 0.01  # steam is very light

    def test_custom_fluid(self):
        A_f = 1.0
        result = calc_fluid_weight_per_foot(A_f, "custom", custom_density_lbft3=80.0)
        expected = 1.0 * 12.0 * (80.0 / 1728.0)
        assert result == approx(expected)

    def test_unknown_fluid_no_custom(self):
        with pytest.raises(ValueError):
            calc_fluid_weight_per_foot(1.0, "liquid_helium")


# ─────────────────────────────────────────────────────────────────────────────
# calc_insulation_weight_per_foot
# ─────────────────────────────────────────────────────────────────────────────
class TestCalcInsulationWeightPerFoot:
    def test_default_density(self):
        A_ins = 5.0
        result = calc_insulation_weight_per_foot(A_ins)
        expected = 5.0 * 12.0 * (5.0 / 1728.0)
        assert result == approx(expected)

    def test_zero_area(self):
        assert calc_insulation_weight_per_foot(0.0) == approx(0.0)

    def test_custom_density(self):
        A_ins = 2.0
        result = calc_insulation_weight_per_foot(A_ins, density_lbft3=8.0)
        expected = 2.0 * 12.0 * (8.0 / 1728.0)
        assert result == approx(expected)


# ─────────────────────────────────────────────────────────────────────────────
# calc_total_operating_weight
# ─────────────────────────────────────────────────────────────────────────────
class TestCalcTotalOperatingWeight:
    def test_basic_sum(self):
        assert calc_total_operating_weight(10.0, 5.0, 1.5) == approx(16.5)

    def test_zero_fluid(self):
        assert calc_total_operating_weight(10.0, 0.0, 0.0) == approx(10.0)


# ─────────────────────────────────────────────────────────────────────────────
# calc_support_span
# ─────────────────────────────────────────────────────────────────────────────
class TestCalcSupportSpan:
    def test_4inch_sch40_water_carbon_steel(self):
        # Known reasonable result: 4" Sch40 CS water ≈ 15-18 ft
        dims = get_pipe_dimensions("4.0", "SCH40", "B36.10M")
        A_m = calc_metal_area(dims["OD_in"], dims["ID_in"])
        A_f = calc_fluid_area(dims["ID_in"])
        W_m = calc_metal_weight_per_foot(A_m, "carbon_steel")
        W_f = calc_fluid_weight_per_foot(A_f, "water")
        W_total = calc_total_operating_weight(W_m, W_f, 0.0)
        result = calc_support_span(dims["OD_in"], dims["ID_in"], W_total, "carbon_steel")
        assert 14.0 <= result["span_calculated_ft"] <= 22.0

    def test_recommended_rounded_down(self):
        dims = get_pipe_dimensions("4.0", "SCH40", "B36.10M")
        A_m = calc_metal_area(dims["OD_in"], dims["ID_in"])
        A_f = calc_fluid_area(dims["ID_in"])
        W_total = calc_total_operating_weight(
            calc_metal_weight_per_foot(A_m, "carbon_steel"),
            calc_fluid_weight_per_foot(A_f, "water"),
            0.0,
        )
        result = calc_support_span(dims["OD_in"], dims["ID_in"], W_total, "carbon_steel")
        rec = result["span_recommended_ft"]
        # Must be multiple of 0.5
        assert rec * 2 == int(rec * 2)
        # Must be ≤ calculated
        assert rec <= result["span_calculated_ft"]

    def test_moment_of_inertia_returned(self):
        result = calc_support_span(4.5, 4.026, 15.0, "carbon_steel")
        I_expected = (math.pi / 64) * (4.5 ** 4 - 4.026 ** 4)
        assert result["moment_of_inertia_in4"] == approx(I_expected)

    def test_large_pipe(self):
        dims = get_pipe_dimensions("24.0", "STD", "B36.10M")
        A_m = calc_metal_area(dims["OD_in"], dims["ID_in"])
        A_f = calc_fluid_area(dims["ID_in"])
        W_total = calc_total_operating_weight(
            calc_metal_weight_per_foot(A_m, "carbon_steel"),
            calc_fluid_weight_per_foot(A_f, "water"),
            0.0,
        )
        result = calc_support_span(dims["OD_in"], dims["ID_in"], W_total, "carbon_steel")
        assert result["span_calculated_ft"] > 20.0  # large pipe spans long

    def test_zero_weight_raises(self):
        with pytest.raises(ValueError):
            calc_support_span(4.5, 4.026, 0.0, "carbon_steel")


# ─────────────────────────────────────────────────────────────────────────────
# calc_fixed_slope_drop
# ─────────────────────────────────────────────────────────────────────────────
class TestCalcFixedSlopeDrop:
    def test_quarter_inch_10ft(self):
        result = calc_fixed_slope_drop(0.25, 10.0)
        assert result["drop_decimal_in"] == approx(2.5)
        assert result["drop_fraction_str"] == '2-1/2"'

    def test_eighth_inch_8ft(self):
        result = calc_fixed_slope_drop(0.125, 8.0)
        assert result["drop_decimal_in"] == approx(1.0)
        assert result["drop_fraction_str"] == '1"'

    def test_sixteenth_inch(self):
        result = calc_fixed_slope_drop(1.0 / 16.0, 16.0)
        assert result["drop_decimal_in"] == approx(1.0)

    def test_zero_run(self):
        result = calc_fixed_slope_drop(0.25, 0.0)
        assert result["drop_decimal_in"] == approx(0.0)


# ─────────────────────────────────────────────────────────────────────────────
# calc_minimum_slope_for_drainage
# ─────────────────────────────────────────────────────────────────────────────
class TestCalcMinimumSlope:
    def test_basic(self):
        # span=20ft, deflection=0.10" → min_slope = 4×0.10/20 = 0.02 in/ft
        result = calc_minimum_slope_for_drainage(20.0, 0.10)
        assert result == approx(0.02)

    def test_zero_span_raises(self):
        with pytest.raises(ValueError):
            calc_minimum_slope_for_drainage(0.0, 0.10)


# ─────────────────────────────────────────────────────────────────────────────
# calc_hydrotest_load
# ─────────────────────────────────────────────────────────────────────────────
class TestCalcHydrotestLoad:
    def test_4inch_sch40(self):
        dims = get_pipe_dimensions("4.0", "SCH40", "B36.10M")
        A_m = calc_metal_area(dims["OD_in"], dims["ID_in"])
        W_m = calc_metal_weight_per_foot(A_m, "carbon_steel")
        result = calc_hydrotest_load(W_m, 0.0, dims["OD_in"], dims["ID_in"], 15.0)
        assert result["W_test_lbft"] > W_m
        assert result["P_test_lb"] > 0

    def test_hydrotest_uses_water(self):
        # Even for steam line, hydrotest should fill with water
        dims = get_pipe_dimensions("6.0", "SCH40", "B36.10M")
        A_f = calc_fluid_area(dims["ID_in"])
        A_m = calc_metal_area(dims["OD_in"], dims["ID_in"])
        W_m = calc_metal_weight_per_foot(A_m, "carbon_steel")
        W_f_water = calc_fluid_weight_per_foot(A_f, "water")
        result = calc_hydrotest_load(W_m, 0.0, dims["OD_in"], dims["ID_in"], 15.0)
        assert result["W_water_lbft"] == approx(W_f_water, rel=1e-3)


# ─────────────────────────────────────────────────────────────────────────────
# check_weld_clearance
# ─────────────────────────────────────────────────────────────────────────────
class TestCheckWeldClearance:
    def test_no_conflicts(self):
        result = check_weld_clearance([5.0, 10.0, 15.0], [7.5, 12.5])
        assert result["pass"] is True
        assert result["conflicts"] == []

    def test_conflict_detected(self):
        # Support at 5.0, weld at 5.05 → gap = 0.6" < 2.0" clearance
        result = check_weld_clearance([5.0], [5.05])
        assert result["pass"] is False
        assert len(result["conflicts"]) == 1

    def test_support_shifted_away(self):
        result = check_weld_clearance([5.0], [5.05])
        adjusted = result["adjusted_locations_ft"]
        # Must be ≥ 2.0" from weld
        gap_in = abs(adjusted[0] - 5.05) * 12
        assert gap_in >= 2.0 - 1e-6

    def test_empty_welds(self):
        result = check_weld_clearance([5.0, 10.0], [])
        assert result["pass"] is True

    def test_audit_entries_generated(self):
        result = check_weld_clearance([5.0], [5.05])
        assert len(result["audit_entries"]) > 0


# ─────────────────────────────────────────────────────────────────────────────
# verify_rod_capacity
# ─────────────────────────────────────────────────────────────────────────────
class TestVerifyRodCapacity:
    def test_half_inch_rod_passes(self):
        # 1/2" rod allowable = 2840 lb. With SF=3, max design load = 2840/3 ≈ 947 lb
        result = verify_rod_capacity(900.0, 0.500, safety_factor=3.0)
        assert result["pass"] is True

    def test_half_inch_rod_fails(self):
        result = verify_rod_capacity(1100.0, 0.500, safety_factor=3.0)
        assert result["pass"] is False

    def test_utilization_calculated(self):
        result = verify_rod_capacity(500.0, 0.500, safety_factor=3.0)
        expected_util = (500.0 * 3.0 / 2840.0) * 100
        assert result["utilization_pct"] == approx(expected_util, rel=1e-2)

    def test_rod_not_in_table_raises(self):
        with pytest.raises(ValueError, match="not found in rod capacity table"):
            verify_rod_capacity(100.0, 99.0)

    def test_largest_rod(self):
        result = verify_rod_capacity(5000.0, 1.500, safety_factor=3.0)
        assert result["allowable_load_lb"] == 28100

    def test_tensile_stress_area(self):
        # 1/2" rod: A_t = 0.7854 × (0.5 - 0.9743/13)² ≈ 0.1419
        result = verify_rod_capacity(100.0, 0.500)
        assert result["A_t_in2"] == approx(0.1419, rel=5e-3)


# ─────────────────────────────────────────────────────────────────────────────
# calc_turnaround_remediation
# ─────────────────────────────────────────────────────────────────────────────
class TestCalcTurnaroundRemediation:
    def test_no_warning(self):
        result = calc_turnaround_remediation(
            existing_sag_in=0.25,
            existing_support_elevation_in=100.0,
            remaining_slot_travel_in=2.0,
            thermal_growth_in=0.5,
            span_ft=15.0,
            W_total_lbft=20.0,
            material="carbon_steel",
            OD_in=4.5,
            ID_in=4.026,
        )
        assert result["slot_travel_warning"] is False
        assert result["shim_thickness_in"] == approx(0.75)

    def test_shim_fraction_str(self):
        result = calc_turnaround_remediation(
            existing_sag_in=0.25,
            existing_support_elevation_in=100.0,
            remaining_slot_travel_in=2.0,
            thermal_growth_in=0.5,
            span_ft=15.0,
            W_total_lbft=20.0,
            material="carbon_steel",
            OD_in=4.5,
            ID_in=4.026,
        )
        assert result["shim_fraction_str"] == '3/4"'

    def test_slot_travel_warning_triggered(self):
        result = calc_turnaround_remediation(
            existing_sag_in=0.5,
            existing_support_elevation_in=100.0,
            remaining_slot_travel_in=0.8,
            thermal_growth_in=0.5,
            span_ft=15.0,
            W_total_lbft=20.0,
            material="carbon_steel",
            OD_in=4.5,
            ID_in=4.026,
        )
        assert result["slot_travel_warning"] is True
        assert len(result["warning_message"]) > 0


# ─────────────────────────────────────────────────────────────────────────────
# generate_rod_cutsheet
# ─────────────────────────────────────────────────────────────────────────────
class TestGenerateRodCutsheet:
    def test_basic_clevis(self):
        result = generate_rod_cutsheet(
            support_type="clevis_hanger",
            pipe_elevation_in=120.0,
            structure_elevation_in=156.0,
            rod_diameter_in=0.5,
            manufacturer_dims={
                "hanger_height_in": 3.0,
                "nut_height_in": 0.5,
                "thread_engagement_in": 1.0,
                "rod_quantity": 1,
            },
        )
        # gross = 156 - 120 - 3 = 33
        assert result["gross_length_in"] == approx(33.0)
        assert result["rod_quantity"] == 1
        assert result["fabrication_cut_length_in"] == approx(35.5)

    def test_cut_length_str_returned(self):
        result = generate_rod_cutsheet(
            support_type="trapeze",
            pipe_elevation_in=100.0,
            structure_elevation_in=124.0,
            rod_diameter_in=0.75,
            manufacturer_dims={"hanger_height_in": 0.0, "rod_quantity": 2},
        )
        assert isinstance(result["fabrication_cut_length_str"], str)
        assert '"' in result["fabrication_cut_length_str"]

    def test_rod_quantity(self):
        result = generate_rod_cutsheet(
            "trapeze", 100.0, 124.0, 0.75,
            {"rod_quantity": 2, "hanger_height_in": 0.0},
        )
        assert result["rod_quantity"] == 2


# ─────────────────────────────────────────────────────────────────────────────
# check_access_interference
# ─────────────────────────────────────────────────────────────────────────────
class TestCheckAccessInterference:
    def test_no_conflict(self):
        zones = [{"type": "valve", "center_ft": 20.0, "radius_ft": 1.0}]
        result = check_access_interference(5.0, zones, clearance_ft=3.0)
        assert result["conflict"] is False

    def test_conflict_detected(self):
        zones = [{"type": "valve", "center_ft": 5.0, "radius_ft": 1.0}]
        result = check_access_interference(5.0, zones, clearance_ft=3.0)
        assert result["conflict"] is True

    def test_resolution_options_provided(self):
        zones = [{"type": "valve", "center_ft": 5.0, "radius_ft": 1.0}]
        result = check_access_interference(5.0, zones)
        assert len(result["resolution_options"]) == 3

    def test_empty_zones(self):
        result = check_access_interference(10.0, [])
        assert result["conflict"] is False


# ─────────────────────────────────────────────────────────────────────────────
# run_full_support_calculation (integration test)
# ─────────────────────────────────────────────────────────────────────────────
class TestFullSupportCalculation:
    def test_4inch_water_carbon_steel(self):
        params = {
            "nps": "4.0",
            "schedule": "SCH40",
            "standard": "B36.10M",
            "material": "carbon_steel",
            "fluid": "water",
            "insulation_thickness_in": 1.0,
            "insulation_density_lbft3": 5.0,
            "deflection_allow_in": 0.10,
            "slope_mode": "fixed",
            "slope_value": 0.125,
            "weld_locations_ft": [7.5, 22.5],
            "support_locations_ft": [0.0, 15.0, 30.0],
            "clearance_in": 2.0,
        }
        result = run_full_support_calculation(params)
        assert "dimensions" in result
        assert "weights" in result
        assert "span" in result
        assert "hydrotest" in result
        assert "weld_clearance" in result
        assert result["weights"]["total_lbft"] > 0

    def test_stainless_steam_no_insulation(self):
        params = {
            "nps": "2.0",
            "schedule": "SCH10S",
            "standard": "B36.19M",
            "material": "stainless_steel",
            "fluid": "steam",
            "insulation_thickness_in": 0.0,
        }
        result = run_full_support_calculation(params)
        assert result["weights"]["insulation_lbft"] == approx(0.0)
        assert result["weights"]["fluid_lbft"] < 0.1  # steam is light
