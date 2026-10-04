export type EnergyInputs = {
  garmentWeightKg: number;
  cuttingUtilizationPct: number;
  knittingKwhPerKg: number;
  dyeingKwhPerKg: number;
  fabricFinishingKwhPerKg: number;
  cuttingKwhPerGarment: number;
  sewingKwhPerGarment: number;
  garmentFinishingKwhPerGarment: number;
  gridSharePct: number;
  solarSharePct: number;
};

export type EnergyResult = {
  fabricRequiredKg: number;
  kwhPerGarment: {
    knitting: number;
    dyeing: number;
    fabricFinishing: number;
    cutting: number;
    sewing: number;
    garmentFinishing: number;
  };
  totalEnergyKwh: number;
  gridEnergyKwh: number;
  solarEnergyKwh: number;
  carbonKgCo2e: number;
};

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Shared energy/carbon math — server and UI use this same function.
 * Converts kWh/kg to kWh/garment FIRST via fabric required, then splits
 * grid/solar and applies emission factors.
 */
export function calcEnergy(
  i: EnergyInputs,
  ef: { grid: number; solar: number }
): EnergyResult {
  if (Math.abs(i.gridSharePct + i.solarSharePct - 100) > 1e-9) {
    throw Object.assign(
      new Error("Grid + Solar percentage must equal 100%."),
      { status: 422 }
    );
  }
  const fabricRequiredKg = i.garmentWeightKg / (i.cuttingUtilizationPct / 100);
  const knitting = i.knittingKwhPerKg * fabricRequiredKg;
  const dyeing = i.dyeingKwhPerKg * fabricRequiredKg;
  const fabricFinishing = i.fabricFinishingKwhPerKg * fabricRequiredKg;
  const cutting = i.cuttingKwhPerGarment;
  const sewing = i.sewingKwhPerGarment;
  const garmentFinishing = i.garmentFinishingKwhPerGarment;
  const totalEnergyKwh = knitting + dyeing + fabricFinishing + cutting + sewing + garmentFinishing;
  const gridEnergyKwh = (totalEnergyKwh * i.gridSharePct) / 100;
  const solarEnergyKwh = (totalEnergyKwh * i.solarSharePct) / 100;
  return {
    fabricRequiredKg: r3(fabricRequiredKg),
    kwhPerGarment: {
      knitting: r3(knitting),
      dyeing: r3(dyeing),
      fabricFinishing: r3(fabricFinishing),
      cutting: r3(cutting),
      sewing: r3(sewing),
      garmentFinishing: r3(garmentFinishing),
    },
    totalEnergyKwh: r3(totalEnergyKwh),
    gridEnergyKwh: r3(gridEnergyKwh),
    solarEnergyKwh: r3(solarEnergyKwh),
    carbonKgCo2e: r3(gridEnergyKwh * ef.grid + solarEnergyKwh * ef.solar),
  };
}
