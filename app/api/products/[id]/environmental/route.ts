import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { requireAdmin, toHttpError } from "@/lib/auth";
import { Product } from "@/lib/models/Product";
import { Environmental } from "@/lib/models/Environmental";
import { EmissionFactor } from "@/lib/models/EmissionFactor";
import { EnvironmentalInput } from "@/lib/validators/environmental";
import {
  validateEnvironmentalInputs,
  calcEnergy,
  NO_FACTOR_MESSAGE,
} from "@/lib/services/environmental";
import { writeAudit } from "@/lib/services/audit";

type Ctx = { params: Promise<{ id: string }> };

type LeanFactor = {
  key: string;
  kgCo2ePerKwh: number;
  source: string;
  yearVersion: string;
} | null;

async function activeFactors(): Promise<{ grid: LeanFactor; solar: LeanFactor }> {
  const [grid, solar] = await Promise.all([
    EmissionFactor.findOne({ type: "grid", active: true }).sort({ updatedAt: -1 }).lean(),
    EmissionFactor.findOne({ type: "solar", active: true }).sort({ updatedAt: -1 }).lean(),
  ]);
  return {
    grid: grid as unknown as LeanFactor,
    solar: solar as unknown as LeanFactor,
  };
}

export async function GET(_req: Request, { params }: Ctx) {
  try {
    await requireAdmin();
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await dbConnect();
    const product = await Product.findById(id).lean();
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const [doc, { grid, solar }] = await Promise.all([
      Environmental.findOne({ productId: id }).lean(),
      activeFactors(),
    ]);
    return NextResponse.json({
      data: doc,
      factors:
        grid && solar
          ? {
              grid: { key: grid.key, value: grid.kgCo2ePerKwh, source: grid.source, yearVersion: grid.yearVersion },
              solar: { key: solar.key, value: solar.kgCo2ePerKwh, source: solar.source, yearVersion: solar.yearVersion },
            }
          : null,
    });
  } catch (e) {
    const { status, message } = toHttpError(e);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const parsed = EnvironmentalInput.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid environmental inputs", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    await dbConnect();
    const product = await Product.findById(id);
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const inputs = validateEnvironmentalInputs(parsed.data);
    const { grid, solar } = await activeFactors();
    if (!grid || !solar) {
      return NextResponse.json({ error: NO_FACTOR_MESSAGE }, { status: 422 });
    }
    const result = calcEnergy(inputs, {
      grid: grid.kgCo2ePerKwh,
      solar: solar.kgCo2ePerKwh,
    });
    const userId = (session.user as unknown as { id?: string }).id;
    const g = grid;
    const s = solar;
    const doc = await Environmental.findOneAndUpdate(
      { productId: id },
      {
        $set: {
          inputs: {
            garmentWeightKg: inputs.garmentWeightKg,
            cuttingUtilizationPct: inputs.cuttingUtilizationPct,
            knittingKwhPerKg: inputs.knittingKwhPerKg,
            dyeingKwhPerKg: inputs.dyeingKwhPerKg,
            fabricFinishingKwhPerKg: inputs.fabricFinishingKwhPerKg,
            cuttingKwhPerGarment: inputs.cuttingKwhPerGarment,
            sewingKwhPerGarment: inputs.sewingKwhPerGarment,
            garmentFinishingKwhPerGarment: inputs.garmentFinishingKwhPerGarment,
            gridSharePct: inputs.gridSharePct,
            solarSharePct: inputs.solarSharePct,
          },
          emissionFactors: {
            gridKey: g.key,
            gridValue: g.kgCo2ePerKwh,
            solarKey: s.key,
            solarValue: s.kgCo2ePerKwh,
            source: `Grid: ${g.source} (${g.yearVersion}); Solar: ${s.source} (${s.yearVersion})`,
            yearVersion: `Grid ${g.yearVersion} / Solar ${s.yearVersion}`,
          },
          results: { ...result, calculatedAt: new Date() },
          dataSource: parsed.data.dataSource?.trim() || undefined,
          updatedBy: userId,
        },
        $setOnInsert: { createdBy: userId },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await writeAudit({
      entity: "Environmental",
      entityId: doc._id,
      field: "save",
      newValue: { carbonKgCo2e: result.carbonKgCo2e },
      changedBy: userId,
    });
    return NextResponse.json({ data: doc });
  } catch (e) {
    const { status, message } = toHttpError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
