# Motor de Cálculo de Costos (WARD-027)

## Descripción General
El motor de cálculo de costos proporciona una forma determinística de previsualizar y calcular el desglose de costos asociados a un viaje. Se apoya en una configuración por tenant (`TenantSettings`) para parámetros globales y permite sobrescribir ciertos valores por viaje o por unidad.

## Decisiones de Diseño

1. **Servicio Puro**: `calculateTripCost` no lee ni escribe en base de datos. Solo procesa la matemática.
2. **TenantSettings**: Tabla 1-a-1 por tenant creada con un enfoque `upsert`. Así siempre se garantizan parámetros default (precio del combustible, costo mensual de seguro, etc.) sin necesidad de que el admin los registre manualmente la primera vez.
3. **Eficiencia de Combustible (Fallback)**: Si el camión tiene una eficiencia específica registrada, se utiliza. Si el dato está en nulo o no se provee, se hace *fallback* al valor `fuel_efficiency_km_l` especificado en `TenantSettings`.

## Estructura de Respuesta
El resultado del motor se emite con este formato unificado:

```json
{
  "tolls": 350.5,
  "fuel": 1250.0,
  "insurance": 300.0,
  "extras": 500.0,
  "total": 2400.5,
  "breakdown": [
    { "category": "tollbooth", "name": "Caseta San Martín", "amount": 150.5 },
    { "category": "fuel", "name": "Combustible", "amount": 1250.0 }
  ]
}
```

## Uso

### Endpoint de previsualización
`POST /api/trips/cost-preview`

**Request:**
```json
{
  "routeId": "...",
  "unitId": "...",
  "extras": [
    { "name": "Viáticos operador", "amount": 500 }
  ]
}
```

### Configuración del Tenant
`GET /api/settings`
`PUT /api/settings`

Ambos endpoints gestionan los ajustes globales, tales como el costo mensual de seguro (usado para calcular la parte prorrateada de un viaje particular) o los viajes mensuales estimados.
