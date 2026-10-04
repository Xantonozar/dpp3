import { z } from "zod";
import {
  EnvironmentalInput,
  EmissionFactorInput,
} from "../validators/environmental";
import { calcEnergy, type EnergyInputs } from "../calc/energy";

export type EnvironmentalData = z.infer<typeof EnvironmentalInput>;
export type EmissionFactorData = z.infer<typeof EmissionFactorInput>;

function err(message: string, status = 422) {
  return Object.assign(new Error(message), { status });
}

export const NO_FACTOR_MESSAGE =
  "Add an emission factor with source and year in Admin > Catalogs to calculate carbon.";

/** Range checks beyond Zod + the exact grid+solar rule. Throws 422. */
export function validateEnvironmentalInputs(input: EnvironmentalData): EnergyInputs {
  const {
    garmentWeightKg,
    cuttingUtilizationPct,
    gridSharePct,
    solarSharePct,
    ...rest
  } = input;
  if (!(garmentWeightKg > 0)) throw err("Garment weight must be above 0.");
  if (!(cuttingUtilizationPct > 0 && cuttingUtilizationPct <= 100)) {
    throw err("Cutting utilization must be above 0 and at most 100.");
  }
  for (const [k, v] of Object.entries(rest)) {
    if (k === "dataSource") continue;
    if (!(v as number >= 0)) throw err(`${k} cannot be negative.`);
  }
  if (Math.abs(gridSharePct + solarSharePct - 100) > 1e-9) {
    throw err("Grid + Solar percentage must equal 100%.");
  }
  return {
    garmentWeightKg,
    cuttingUtilizationPct,
    knittingKwhPerKg: rest.knittingKwhPerKg,
    dyeingKwhPerKg: rest.dyeingKwhPerKg,
    fabricFinishingKwhPerKg: rest.fabricFinishingKwhPerKg,
    cuttingKwhPerGarment: rest.cuttingKwhPerGarment,
    sewingKwhPerGarment: rest.sewingKwhPerGarment,
    garmentFinishingKwhPerGarment: rest.garmentFinishingKwhPerGarment,
    gridSharePct,
    solarSharePct,
  };
}

export { calcEnergy };
