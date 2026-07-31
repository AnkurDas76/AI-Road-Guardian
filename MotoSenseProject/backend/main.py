from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import h3
import random
from supabase import create_client, Client

app = FastAPI(title="MotoSense Context-Aware Backend", version="3.0")

SUPABASE_URL = "https://neeudmyvmvibuudlrgev.supabase.co"
SUPABASE_KEY = "sb_publishable_FocXf3fWCqN5gaZnWbA0gA_U7USvt47"
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

H3_RESOLUTION = 8

# ==========================================
# PYDANTIC SCHEMAS
# ==========================================

class CrowdsourceHazardInput(BaseModel):
    latitude: float
    longitude: float
    type: str  # 'pothole', 'speed_breaker', 'railway'
    initial_severity: str = 'severe'  # 'minor' or 'severe'
    is_lit: bool = True

class ConstructionWorkInput(BaseModel):
    latitude: float
    longitude: float
    company_name: str
    is_lit: bool = False

class WithdrawConstructionInput(BaseModel):
    hazard_id: str

# ==========================================
# CORE ALGORITHMIC LOGIC
# ==========================================

def calculate_stage(created_at_iso: str, hazard_type: str, initial_severity: str) -> int:
    """Calculates the aging stage of a hazard."""
    if hazard_type == 'construction':
        return 1  # Construction is perpetually Stage 1 until withdrawn
    
    created_dt = datetime.fromisoformat(created_at_iso.replace('Z', '+00:00'))
    days_old = (datetime.now(timezone.utc) - created_dt).days
    
    if days_old <= 14:
        # NEW RULE: Minor hazards skip Stage 1 and go directly to Stage 2
        if initial_severity == 'minor':
            return 2
        return 1
    elif days_old <= 30:
        return 2  # 2 to 4 weeks old
    else:
        return 3  # Over 1 month old

def evaluate_rider_action(hazard: dict, is_first_timer: bool, current_hour: int) -> str:
    """
    Returns the exact action the frontend must take: 
    'FORCE_ALARM', 'SPEED_GATED_ALARM', or 'IGNORE'
    """
    hazard_type = hazard['type']
    is_lit = hazard['is_lit']
    
    stage = calculate_stage(hazard['created_at'], hazard_type, hazard.get('initial_severity', 'severe'))
    
    # RULE 1: First-timers get warned for EVERYTHING
    if is_first_timer:
        return "FORCE_ALARM"
        
    # --- ALL LOGIC BELOW THIS LINE APPLIES ONLY TO LOCALS ---
    
    # RULE 2: Stage 1 (Severe New / Construction) is ALWAYS forced
    if stage == 1:
        return "FORCE_ALARM"
        
    # RULE 3: Night time (11 PM - 5 AM) AND Unlit is ALWAYS forced
    if not is_lit and (current_hour >= 23 or current_hour < 5):
        return "FORCE_ALARM"
        
    # RULE 4: Stage 2/3 during Daytime OR Lit Night-time
    # The hazard is known/visible, so only alarm if the rider is coming in too fast
    return "SPEED_GATED_ALARM"

# ==========================================
# API ENDPOINTS
# ==========================================

@app.post("/api/hazards/crowdsource")
async def add_crowdsourced_hazard(payload: CrowdsourceHazardInput):
    """Allows general users to report potholes or speed breakers."""
    if payload.initial_severity not in ['minor', 'severe']:
        raise HTTPException(status_code=400, detail="initial_severity must be 'minor' or 'severe'")

    h3_idx = h3.latlng_to_cell(payload.latitude, payload.longitude, H3_RESOLUTION)
    
    record = {
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "h3_index": h3_idx,
        "type": payload.type,
        "initial_severity": payload.initial_severity,
        "reporter_type": "crowdsourced",
        "is_lit": payload.is_lit,
        "active": True
    }
    
    res = supabase.table("hazards").insert(record).execute()
    return {"status": "success", "data": res.data}


@app.post("/api/hazards/construction/register")
async def register_construction(payload: ConstructionWorkInput):
    """Construction companies register active road work."""
    h3_idx = h3.latlng_to_cell(payload.latitude, payload.longitude, H3_RESOLUTION)
    
    record = {
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "h3_index": h3_idx,
        "type": "construction",
        "initial_severity": "severe", # Construction is always severe
        "reporter_type": "contractor",
        "is_lit": payload.is_lit,
        "active": True
    }
    
    res = supabase.table("hazards").insert(record).execute()
    return {"status": "registered", "hazard_id": res.data[0]['id']}


@app.post("/api/hazards/construction/withdraw")
async def withdraw_construction(payload: WithdrawConstructionInput):
    """Explicitly withdraws a construction hazard."""
    res = supabase.table("hazards").update({
        "active": False,
        "resolved_at": datetime.now(timezone.utc).isoformat()
    }).eq("id", payload.hazard_id).execute()
    
    if not res.data:
        raise HTTPException(status_code=404, detail="Hazard ID not found")
        
    return {"status": "withdrawn", "message": "Safety warning deactivated."}


@app.get("/api/hazards/nearby")
async def get_nearby_hazards(
    latitude: float, 
    longitude: float, 
    is_first_timer: bool = True,
    current_hour: Optional[int] = Query(default=None, ge=0, le=23)
):
    """
    Evaluates raw spatial data against the decision matrix and returns actionable commands.
    """
    if current_hour is None:
        current_hour = datetime.now().hour
        
    center_h3 = h3.latlng_to_cell(latitude, longitude, H3_RESOLUTION)
    neighbor_h3s = list(h3.grid_disk(center_h3, 1))
    
    res = supabase.table("hazards").select("*").in_("h3_index", neighbor_h3s).eq("active", True).execute()
    active_hazards = res.data or []
    
    evaluated_hazards = []
    
    for h in active_hazards:
        action = evaluate_rider_action(h, is_first_timer, current_hour)
        
        if action != "IGNORE":
            h_copy = dict(h)
            h_copy['calculated_stage'] = calculate_stage(h['created_at'], h['type'], h.get('initial_severity', 'severe'))
            h_copy['frontend_action'] = action # 'FORCE_ALARM' or 'SPEED_GATED_ALARM'
            evaluated_hazards.append(h_copy)
            
    return {
        "context": {
            "is_first_timer": is_first_timer,
            "evaluated_hour": current_hour
        },
        "hazards": evaluated_hazards
    }