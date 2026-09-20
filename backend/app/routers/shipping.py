import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field
import httpx

from app.core.config import settings

logger = logging.getLogger("uvicorn.error")

router = APIRouter()

# ---------------------------------------------------------------------------
# RajaOngkir V2 (Komerce) — migrated from defunct api.rajaongkir.com/starter
# Docs: https://komerceapi.readme.io/reference/rajaongkir-api
# ---------------------------------------------------------------------------
RAJAONGKIR_BASE_URL = "https://rajaongkir.komerce.id/api/v1"

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class ProvinceItem(BaseModel):
    id: str
    name: str


class CityItem(BaseModel):
    id: str
    name: str
    type: str
    city_name: str
    postal_code: str
    province_id: str


class ShippingCostRequest(BaseModel):
    destination_city_id: str = Field(..., description="RajaOngkir destination city ID")
    weight_grams: int = Field(1000, ge=1, description="Weight in grams")
    courier: str = Field("jne", description="Courier code: jne, pos, or tiki")
    origin_city_id: Optional[str] = Field(None, description="Optional custom origin city ID")


class ShippingOption(BaseModel):
    courier: str
    service: str
    description: str
    cost: float
    etd: str


# ---------------------------------------------------------------------------
# Fallback Mock Data
# ---------------------------------------------------------------------------
MOCK_PROVINCES = [
    {"id": "1", "name": "Bali"},
    {"id": "5", "name": "DI Yogyakarta"},
    {"id": "6", "name": "DKI Jakarta"},
    {"id": "9", "name": "Jawa Barat"},
    {"id": "10", "name": "Jawa Tengah"},
    {"id": "11", "name": "Jawa Timur"},
    {"id": "33", "name": "Sumatra Selatan"},
    {"id": "34", "name": "Sumatra Utara"}
]

MOCK_CITIES = {
    "6": [
        {"id": "151", "name": "Kota Jakarta Barat", "type": "Kota", "city_name": "Jakarta Barat", "postal_code": "11000", "province_id": "6"},
        {"id": "152", "name": "Kota Jakarta Selatan", "type": "Kota", "city_name": "Jakarta Selatan", "postal_code": "12000", "province_id": "6"},
        {"id": "153", "name": "Kota Jakarta Timur", "type": "Kota", "city_name": "Jakarta Timur", "postal_code": "13000", "province_id": "6"},
        {"id": "154", "name": "Kota Jakarta Utara", "type": "Kota", "city_name": "Jakarta Utara", "postal_code": "14000", "province_id": "6"},
        {"id": "155", "name": "Kota Jakarta Pusat", "type": "Kota", "city_name": "Jakarta Pusat", "postal_code": "10000", "province_id": "6"}
    ],
    "9": [
        {"id": "22", "name": "Kota Bandung", "type": "Kota", "city_name": "Bandung", "postal_code": "40000", "province_id": "9"},
        {"id": "23", "name": "Kabupaten Bandung", "type": "Kabupaten", "city_name": "Bandung", "postal_code": "40300", "province_id": "9"},
        {"id": "55", "name": "Kota Bogor", "type": "Kota", "city_name": "Bogor", "postal_code": "16000", "province_id": "9"},
        {"id": "78", "name": "Kota Depok", "type": "Kota", "city_name": "Depok", "postal_code": "16400", "province_id": "9"},
        {"id": "54", "name": "Kota Bekasi", "type": "Kota", "city_name": "Bekasi", "postal_code": "17000", "province_id": "9"}
    ],
    "5": [
        {"id": "501", "name": "Kota Yogyakarta", "type": "Kota", "city_name": "Yogyakarta", "postal_code": "55000", "province_id": "5"},
        {"id": "419", "name": "Kabupaten Sleman", "type": "Kabupaten", "city_name": "Sleman", "postal_code": "55500", "province_id": "5"},
        {"id": "84", "name": "Kabupaten Bantul", "type": "Kabupaten", "city_name": "Bantul", "postal_code": "55700", "province_id": "5"}
    ],
    "11": [
        {"id": "444", "name": "Kota Surabaya", "type": "Kota", "city_name": "Surabaya", "postal_code": "60000", "province_id": "11"},
        {"id": "256", "name": "Kota Malang", "type": "Kota", "city_name": "Malang", "postal_code": "65100", "province_id": "11"}
    ],
    "1": [
        {"id": "114", "name": "Kota Denpasar", "type": "Kota", "city_name": "Denpasar", "postal_code": "80000", "province_id": "1"}
    ]
}


def _get_mock_shipping_options(courier: str, weight_grams: int) -> List[ShippingOption]:
    weight_kg = max(1, (weight_grams + 999) // 1000)
    courier_lower = courier.lower()

    if courier_lower == "jne":
        return [
            ShippingOption(
                courier="jne",
                service="REG",
                description="Layanan Reguler",
                cost=14000.0 * weight_kg,
                etd="1-2 HARI"
            )
        ]
    elif courier_lower == "pos":
        return [
            ShippingOption(
                courier="pos",
                service="REG",
                description="Pos Reguler",
                cost=14000.0 * weight_kg,
                etd="2 HARI"
            )
        ]
    elif courier_lower == "tiki":
        return [
            ShippingOption(
                courier="tiki",
                service="REG",
                description="Regular Service",
                cost=14000.0 * weight_kg,
                etd="2 HARI"
            )
        ]
    else:
        return [
            ShippingOption(
                courier=courier_lower,
                service="REG",
                description="Standard Shipping",
                cost=14000.0 * weight_kg,
                etd="2-3 HARI"
            )
        ]


def _has_valid_api_key() -> bool:
    key = settings.RAJAONGKIR_API_KEY
    return bool(key and key.strip() and key.strip() != "your_rajaongkir_api_key_here")


# ---------------------------------------------------------------------------
# Endpoints — RajaOngkir V2 (Komerce)
#
# Response structure (V2):
#   { "meta": { "message": "...", "code": 200, "status": "success" },
#     "data": [ ... ] }
#
# Old V1 structure (defunct):
#   { "rajaongkir": { "results": [ ... ] } }
# ---------------------------------------------------------------------------

@router.get(
    "/provinces",
    response_model=List[ProvinceItem],
    summary="List all provinces",
    description="Proxies RajaOngkir V2 API /destination/province. Falls back to mock data on error.",
)
async def get_provinces():
    target_url = f"{RAJAONGKIR_BASE_URL}/destination/province"
    if not _has_valid_api_key():
        msg = f"[DEBUG /provinces FALLBACK] API key not set or invalid placeholder. URL: {target_url} — returning MOCK_PROVINCES"
        logger.info(msg)
        print(msg)
        return MOCK_PROVINCES

    headers = {"key": settings.RAJAONGKIR_API_KEY.strip()}
    res = None
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get(target_url, headers=headers, timeout=10.0)
            print(f"[DEBUG /provinces] URL: {target_url}  STATUS: {res.status_code}")
            if res.status_code != 200:
                msg = (
                    f"\n[DEBUG /provinces FALLBACK - HTTP {res.status_code}]\n"
                    f"  URL Called: {target_url}\n"
                    f"  Status Code: {res.status_code}\n"
                    f"  Response Body: {res.text}\n"
                )
                logger.warning(msg)
                print(msg)
                return MOCK_PROVINCES

            data = res.json()
            # V2 response: { "meta": {...}, "data": [ {"id": 1, "name": "..."}, ... ] }
            results = data.get("data", [])
            print(f"[DEBUG /provinces] SUCCESS — got {len(results)} provinces from API")
            output = []
            for item in results:
                output.append(ProvinceItem(
                    id=str(item.get("id")),
                    name=str(item.get("name", ""))
                ))
            return output
        except Exception as err:
            status_code = res.status_code if res is not None else "N/A (Request Failed)"
            resp_body = res.text if res is not None else str(err)
            msg = (
                f"\n[DEBUG /provinces FALLBACK - EXCEPTION]\n"
                f"  URL Called: {target_url}\n"
                f"  Status Code: {status_code}\n"
                f"  Response / Error Message: {resp_body}\n"
                f"  Exception detail: {repr(err)}\n"
            )
            logger.error(msg)
            print(msg)
            return MOCK_PROVINCES


@router.get(
    "/cities",
    response_model=List[CityItem],
    summary="List cities by province ID",
    description="Proxies RajaOngkir V2 API /destination/city/{province_id}. Falls back to mock data on error.",
)
async def get_cities(province_id: str = Query(..., description="RajaOngkir Province ID")):
    if not _has_valid_api_key():
        logger.info(f"[Shipping] RajaOngkir API key not set — returning mock cities for province {province_id}.")
        return MOCK_CITIES.get(province_id, [
            {"id": f"{province_id}01", "name": "Kota Utama", "type": "Kota", "city_name": "Utama", "postal_code": "10000", "province_id": province_id},
            {"id": f"{province_id}02", "name": "Kabupaten Daerah", "type": "Kabupaten", "city_name": "Daerah", "postal_code": "10100", "province_id": province_id}
        ])

    # V2: GET /destination/city/{province_id}  (path param, not query param)
    target_url = f"{RAJAONGKIR_BASE_URL}/destination/city/{province_id}"
    headers = {"key": settings.RAJAONGKIR_API_KEY.strip()}
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get(target_url, headers=headers, timeout=10.0)
            print(f"[DEBUG /cities] URL: {target_url}  STATUS: {res.status_code}")
            if res.status_code != 200:
                logger.warning(f"[Shipping] RajaOngkir HTTP {res.status_code} on /destination/city — using fallback.")
                print(f"[DEBUG /cities FALLBACK] HTTP {res.status_code}: {res.text}")
                return MOCK_CITIES.get(province_id, [])

            data = res.json()
            # V2 response: { "meta": {...}, "data": [ {"id": 1360, "name": "JAKARTA SELATAN", "zip_code": "0"}, ... ] }
            results = data.get("data", [])
            print(f"[DEBUG /cities] SUCCESS — got {len(results)} cities for province {province_id}")
            output = []
            for item in results:
                city_name = str(item.get("name", ""))
                output.append(CityItem(
                    id=str(item.get("id")),
                    name=city_name,
                    type="",               # V2 doesn't return separate type
                    city_name=city_name,
                    postal_code=str(item.get("zip_code", "")),
                    province_id=str(province_id)
                ))
            return output
        except Exception as err:
            logger.error(f"[Shipping] Error calling RajaOngkir /destination/city: {err}")
            print(f"[DEBUG /cities EXCEPTION] {repr(err)}")
            return MOCK_CITIES.get(province_id, [])


@router.post(
    "/cost",
    response_model=List[ShippingOption],
    summary="Calculate shipping cost & ETD",
    description="Proxies RajaOngkir V2 API /calculate/domestic-cost. Calculates costs for origin -> destination.",
)
async def calculate_shipping_cost(payload: ShippingCostRequest):
    origin_id = payload.origin_city_id or settings.ORIGIN_CITY_ID or "152"
    courier_code = payload.courier.lower().strip()

    if not _has_valid_api_key():
        logger.info("[Shipping] RajaOngkir API key not set — returning mock shipping calculation.")
        return _get_mock_shipping_options(courier_code, payload.weight_grams)

    # V2: POST /calculate/domestic-cost
    # Body: JSON { "origin": "...", "destination": "...", "weight": 1000, "courier": "jne:pos:tiki" }
    # Courier codes are colon-separated in V2
    target_url = f"{RAJAONGKIR_BASE_URL}/calculate/domestic-cost"
    headers = {
        "key": settings.RAJAONGKIR_API_KEY.strip(),
        "content-type": "application/x-www-form-urlencoded"
    }
    body_data = {
        "origin": origin_id,
        "destination": payload.destination_city_id,
        "weight": str(payload.weight_grams),
        "courier": courier_code
    }

    msg = f"[DEBUG /cost PARAMS] origin='{origin_id}', destination='{payload.destination_city_id}', weight='{payload.weight_grams}', courier='{courier_code}'"
    print(msg)
    logger.info(msg)

    async with httpx.AsyncClient() as client:
        try:
            res = await client.post(
                target_url,
                data=body_data,
                headers=headers,
                timeout=10.0
            )
            print(f"[DEBUG /cost] URL: {target_url}  STATUS: {res.status_code}")
            if res.status_code != 200:
                logger.warning(f"[Shipping] RajaOngkir HTTP {res.status_code} on /calculate/domestic-cost — using fallback.")
                print(f"[DEBUG /cost FALLBACK] HTTP {res.status_code}: {res.text}")
                return _get_mock_shipping_options(courier_code, payload.weight_grams)

            data = res.json()
            # V2 response: { "meta": {...}, "data": [ {"name": "...", "code": "jne", "service": "REG",
            #   "description": "...", "cost": 18000, "etd": "6 day"}, ... ] }
            results = data.get("data", [])
            print(f"[DEBUG /cost RAW DATA for dest={payload.destination_city_id}] -> {results}")
            options = []

            for item in results:
                courier_name = str(item.get("code", courier_code)).lower()
                service_name = str(item.get("service", "")).strip()
                desc = str(item.get("description", ""))
                cost_val = float(item.get("cost", 0))
                etd = str(item.get("etd", ""))
                options.append(ShippingOption(
                    courier=courier_name,
                    service=service_name,
                    description=desc,
                    cost=cost_val,
                    etd=etd
                ))

            # Automatically select and use only the JNE REG (Layanan Reguler) service
            jne_reg = None
            for opt in options:
                if opt.courier == "jne" and opt.service.upper() == "REG":
                    jne_reg = opt
                    break

            if not jne_reg:
                for opt in options:
                    if opt.courier == "jne" and "REG" in opt.service.upper():
                        jne_reg = opt
                        break

            if not jne_reg and options:
                jne_reg = options[0]

            if jne_reg:
                return [jne_reg]

            return _get_mock_shipping_options(courier_code, payload.weight_grams)

        except Exception as err:
            logger.error(f"[Shipping] Error calling RajaOngkir /calculate/domestic-cost: {err}")
            print(f"[DEBUG /cost EXCEPTION] {repr(err)}")
            return _get_mock_shipping_options(courier_code, payload.weight_grams)
