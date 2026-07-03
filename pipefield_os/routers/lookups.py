"""Pipe Dimension & Rod Capacity Lookup Routes"""

from fastapi import APIRouter, HTTPException
from ..calculations.pipe_support import get_pipe_dimensions, _load_rod_capacities
from ..schemas.schemas import PipeDimsOut, RodCapacityOut

router = APIRouter(tags=["lookups"])


@router.get("/pipe-dimensions/{nps}/{schedule}", response_model=PipeDimsOut)
def lookup_pipe_dims(nps: str, schedule: str, standard: str = "B36.10M"):
    try:
        dims = get_pipe_dimensions(nps, schedule, standard)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return PipeDimsOut(
        nps=nps, schedule=schedule, standard=standard,
        OD_in=dims["OD_in"], wall_in=dims["wall_in"], ID_in=dims["ID_in"]
    )


@router.get("/rod-capacities/{diameter}", response_model=RodCapacityOut)
def lookup_rod_capacity(diameter: float):
    caps = _load_rod_capacities()
    rod = next((r for r in caps if abs(r["diameter_in"] - diameter) < 1e-4), None)
    if not rod:
        available = [r["diameter_in"] for r in caps]
        raise HTTPException(status_code=404, detail=f"Rod {diameter}\" not found. Available: {available}")
    return RodCapacityOut(**rod)
