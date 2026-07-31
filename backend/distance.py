import math
import logging

logger = logging.getLogger(__name__)

def haversine_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculates the great-circle distance between two points on the Earth
    specified in decimal degrees (latitude and longitude) using the Haversine formula.
    
    Returns:
        float: Distance between the two coordinates in meters.
    """
    R = 6371000.0  # Earth's mean radius in meters

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2)
    
    # Protect against float precision issues bounding atan2 inputs
    a = min(1.0, max(0.0, a))
    
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    return R * c

def find_nearby_entities(source_lat: float, source_lon: float, entities: list, radius_meters: float) -> list:
    """
    Filters a list of entity dictionaries containing 'lat' and 'lon' keys
    that fall within the specified radius in meters from (source_lat, source_lon).
    
    Returns entity dicts enriched with calculated 'distance' in meters.
    """
    nearby = []
    for entity in entities:
        try:
            ent_lat = float(entity['lat'])
            ent_lon = float(entity['lon'])
            dist = haversine_distance_m(source_lat, source_lon, ent_lat, ent_lon)
            
            if dist <= radius_meters:
                entity_copy = dict(entity)
                entity_copy['distance'] = round(dist, 2)
                nearby.append(entity_copy)
        except (ValueError, KeyError, TypeError) as e:
            logger.warning(f"Error processing entity for distance: {entity}, error: {e}")
            continue
            
    # Sort by distance ascending (closest first)
    nearby.sort(key=lambda x: x['distance'])
    return nearby
