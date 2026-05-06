import { Decimal } from "@prisma/client/runtime/library";
import { RouteTollbooth, Tollbooth } from "@prisma/client";

export interface RouteTollboothWithTollbooth extends RouteTollbooth {
  tollbooth: Tollbooth;
}

export interface CostCalculatorParams {
  route: {
    distance_km: number;
    route_tollbooths: RouteTollboothWithTollbooth[];
  };
  unit: {
    axles: number;
    fuel_efficiency_km_l: Decimal | number | null;
  };
  settings: {
    fuel_price_per_liter: number;
    fuel_efficiency_km_l: number;
    estimated_trips_per_month: number;
    monthly_insurance_cost: number;
  };
  extras?: {
    name: string;
    amount: number;
  }[];
}

export interface BreakdownItem {
  category: "tollbooth" | "fuel" | "insurance" | "extra";
  name: string;
  amount: number;
}

export interface TripCostBreakdown {
  tolls: number;
  fuel: number;
  insurance: number;
  extras: number;
  total: number;
  breakdown: BreakdownItem[];
}

export function calculateTripCost(params: CostCalculatorParams): TripCostBreakdown {
  const breakdown: BreakdownItem[] = [];

  // 1. Tollbooths
  let tolls = 0;
  for (const rt of params.route.route_tollbooths) {
    if (!rt.tollbooth.active) continue;

    let cost = 0;
    switch (params.unit.axles) {
      case 2:
        cost = rt.tollbooth.cost_2_axles;
        break;
      case 3:
        cost = rt.tollbooth.cost_3_axles;
        break;
      case 4:
        cost = rt.tollbooth.cost_4_axles;
        break;
      case 5:
        cost = rt.tollbooth.cost_5_axles;
        break;
      case 6:
        cost = rt.tollbooth.cost_6_axles;
        break;
      default:
        if (params.unit.axles >= 7) {
          cost = rt.tollbooth.cost_7_plus_axles;
        }
        break;
    }

    tolls += cost;
    if (cost > 0) {
      breakdown.push({
        category: "tollbooth",
        name: `Caseta: ${rt.tollbooth.name}`,
        amount: cost,
      });
    }
  }

  // 2. Fuel
  let unitEfficiency = params.unit.fuel_efficiency_km_l;
  if (typeof unitEfficiency !== "number" && unitEfficiency != null) {
      unitEfficiency = Number(unitEfficiency.toString());
  }

  const efficiency = (unitEfficiency && (unitEfficiency as number) > 0) 
    ? (unitEfficiency as number) 
    : params.settings.fuel_efficiency_km_l;

  const fuel = efficiency > 0 ? (params.route.distance_km / efficiency) * params.settings.fuel_price_per_liter : 0;
  
  if (fuel > 0) {
    breakdown.push({
      category: "fuel",
      name: "Combustible",
      amount: fuel,
    });
  }

  // 3. Insurance
  const insurance = params.settings.estimated_trips_per_month > 0 
    ? params.settings.monthly_insurance_cost / params.settings.estimated_trips_per_month 
    : 0;

  if (insurance > 0) {
    breakdown.push({
      category: "insurance",
      name: "Seguro prorrateado",
      amount: insurance,
    });
  }

  // 4. Extras
  let extras = 0;
  if (params.extras && params.extras.length > 0) {
    for (const ext of params.extras) {
      extras += ext.amount;
      breakdown.push({
        category: "extra",
        name: ext.name,
        amount: ext.amount,
      });
    }
  }

  const total = tolls + fuel + insurance + extras;

  return {
    tolls,
    fuel,
    insurance,
    extras,
    total,
    breakdown,
  };
}
