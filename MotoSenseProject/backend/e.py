import duckdb
import pandas as pd
import h3
import math
import random
from supabase import create_client, Client

# ==========================================
# 1. Configuration
# ==========================================
CENTER_LON = 87.798524
CENTER_LAT = 23.810714
RADIUS_KM = 10.0  

H3_RESOLUTION = 8

SUPABASE_URL = "https://neeudmyvmvibuudlrgev.supabase.co"
SUPABASE_KEY = "sb_publishable_FocXf3fWCqN5gaZnWbA0gA_U7USvt47"

# Bounding box calculation
lat_offset = RADIUS_KM / 111.32
lon_offset = RADIUS_KM / (111.32 * math.cos(math.radians(CENTER_LAT)))

MIN_LON = CENTER_LON - lon_offset
MAX_LON = CENTER_LON + lon_offset
MIN_LAT = CENTER_LAT - lat_offset
MAX_LAT = CENTER_LAT + lat_offset

def get_distance_km(lon1, lat1, lon2, lat2):
    R = 6371.0
    dlon = math.radians(lon2 - lon1)
    dlat = math.radians(lat2 - lat1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def main():
    print("Connecting to DuckDB (S3 Parquet mode)...")
    con = duckdb.connect()
    con.execute("INSTALL spatial; LOAD spatial;")
    con.execute("INSTALL httpfs; LOAD httpfs;")

    latest_version = con.execute("SELECT latest FROM 'https://stac.overturemaps.org/catalog.json'").fetchone()[0]
    print(f"Overture Catalog Release: {latest_version}")

    # ==========================================
    # 2. Download Road Geometries (No Railways)
    # ==========================================
    print(f"Downloading road geometries within {RADIUS_KM}km radius...")
    
    query = f"""
        SELECT 
            ST_X(ST_Centroid(geometry)) AS longitude,
            ST_Y(ST_Centroid(geometry)) AS latitude,
            class,
            subclass
        FROM read_parquet('s3://overturemaps-us-west-2/release/{latest_version}/theme=transportation/type=segment/*', filename=true, hive_partitioning=1)
        WHERE 
            bbox.xmin BETWEEN {MIN_LON} AND {MAX_LON}
            AND bbox.ymin BETWEEN {MIN_LAT} AND {MAX_LAT}
            AND class IN ('primary', 'secondary', 'trunk', 'tertiary', 'residential', 'unclassified')
    """
    
    df = con.execute(query).df()
    print(f"Downloaded {len(df)} road segments from Overture. Mapping hazards...")

    # ==========================================
    # 3. Hazard Generation (Potholes & Bumps)
    # ==========================================
    hazards_list = []
    
    for _, row in df.iterrows():
        lon, lat = row['longitude'], row['latitude']
        h3_idx = h3.latlng_to_cell(lat, lon, H3_RESOLUTION)
        
        hazard_type = None
        
        # Check for explicitly tagged speed breakers in Overture
        if pd.notna(row['subclass']) and row['subclass'] in ['bump', 'hump', 'rumble_strip']:
            hazard_type = "speed_breaker"
        else:
            # Inject hazards along real downloaded road coordinates
            rand = random.random()
            if rand < 0.12:      # 12% chance for Speed Breaker
                hazard_type = "speed_breaker"
            elif rand < 0.22:    # 10% chance for Pothole
                hazard_type = "pothole"

        if hazard_type:
            # Assign severity tier (minor vs severe) & lighting context
            severity = "severe" if random.random() < 0.4 else "minor"
            is_lit = random.choice([True, False])
            
            hazards_list.append({
                "latitude": round(lat, 6),
                "longitude": round(lon, 6),
                "h3_index": h3_idx,
                "type": hazard_type,
                "initial_severity": severity,
                "reporter_type": "system",
                "is_lit": is_lit,
                "active": True
            })

    df_hazards = pd.DataFrame(hazards_list)
    if df_hazards.empty:
        print("No hazards generated.")
        return

    # Deduplicate & apply circular boundary filter
    df_clean = df_hazards.drop_duplicates(subset=['longitude', 'latitude']).copy()
    df_clean['distance'] = df_clean.apply(
        lambda row: get_distance_km(CENTER_LON, CENTER_LAT, row['longitude'], row['latitude']), axis=1
    )
    df_final = df_clean[df_clean['distance'] <= RADIUS_KM].drop(columns=['distance'])
    
    print(f"\nFinal Generated Hazards: {len(df_final)}")
    print(df_final[['type', 'initial_severity']].value_counts())

    # ==========================================
    # 4. Supabase Upsert
    # ==========================================
    print("\nUploading to Supabase...")
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        records_to_insert = df_final.to_dict('records')
        
        if records_to_insert:
            chunk_size = 500
            for i in range(0, len(records_to_insert), chunk_size):
                chunk = records_to_insert[i:i + chunk_size]
                supabase.table("hazards").upsert(chunk).execute()
                
            print(f"🎉 SUCCESS: Inserted {len(records_to_insert)} speed breakers & potholes into Supabase!")
    except Exception as e:
        print(f"Upload failed: {e}")

if __name__ == "__main__":
    main()