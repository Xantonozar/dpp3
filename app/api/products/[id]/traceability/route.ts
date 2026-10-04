import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { requireAdmin, toHttpError } from "@/lib/auth";
import { Product } from "@/lib/models/Product";
import { Facility } from "@/lib/models/Facility";
import { Traceability } from "@/lib/models/Traceability";
import { TraceabilityInput } from "@/lib/validators/traceability";
import { validateTraceabilityFinal } from "@/lib/services/traceability";
import { writeAudit } from "@/lib/services/audit";

type Ctx = { params: Promise<{ id: string }> };

async function linkFacilities(
  groups: { name: string; location: string }[],
  kind: "garment" | "fabric"
) {
  const ids: (mongoose.Types.ObjectId | undefined)[] = [];
  for (const g of groups) {
    if (!g.name.trim() || !g.location.trim()) {
      ids.push(undefined);
      continue;
    }
    const doc = await Facility.findOneAndUpdate(
      { name: g.name.trim(), location: g.location.trim() },
      { $setOnInsert: { kind } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    ids.push(doc._id);
  }
  return ids;
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
    const doc = await Traceability.findOne({ productId: id }).lean();
    return NextResponse.json({ data: doc });
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
    const parsed = TraceabilityInput.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid traceability", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    await dbConnect();
    const product = await Product.findById(id);
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data = parsed.data;
    let warnings: string[] = [];
    if (data.mode === "final") {
      ({ warnings } = validateTraceabilityFinal(data));
    }

    const t1Ids = await linkFacilities(data.tier1.facilities, "garment");
    const t2Ids = await linkFacilities(data.tier2.facilities, "fabric");
    const userId = (session.user as unknown as { id?: string }).id;

    const doc = await Traceability.findOneAndUpdate(
      { productId: id },
      {
        $set: {
          originDestination: {
            countryOfManufacture: data.originDestination.countryOfManufacture?.trim() || undefined,
            finalFactory: data.originDestination.finalFactory?.trim() || undefined,
            finalFactoryLocation: data.originDestination.finalFactoryLocation?.trim() || undefined,
            destinationCountry: data.originDestination.destinationCountry?.trim() || undefined,
            destinationMarket: data.originDestination.destinationMarket?.trim() || undefined,
            buyerBrand: data.originDestination.buyerBrand?.trim() || product.buyerBrand,
          },
          tier1: {
            arrangement: data.tier1.arrangement,
            facilities: data.tier1.facilities.map((g, i) => ({
              facilityId: t1Ids[i],
              name: g.name.trim(),
              location: g.location.trim(),
              processes: g.processes,
              processStatus: g.processStatus,
            })),
          },
          tier2: {
            arrangement: data.tier2.arrangement,
            printingStatus: data.tier2.printingStatus,
            facilities: data.tier2.facilities.map((g, i) => ({
              facilityId: t2Ids[i],
              name: g.name.trim(),
              location: g.location.trim(),
              processes: g.processes,
              processStatus: g.processStatus,
            })),
          },
          tier3: {
            yarnManufacturers: data.tier3.yarnManufacturers.map((y) => ({
              name: y.name.trim(),
              location: y.location.trim(),
              country: y.country.trim(),
              yarnType: y.yarnType?.trim() || undefined,
              yarnCount: y.yarnCount?.trim() || undefined,
              composition: y.composition?.trim() || undefined,
              referenceLot: y.referenceLot?.trim() || undefined,
            })),
          },
          dataSource: data.dataSource?.trim() || undefined,
          updatedBy: userId,
        },
        $setOnInsert: { createdBy: userId },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await writeAudit({
      entity: "Traceability",
      entityId: doc._id,
      field: data.mode === "final" ? "final-save" : "draft-save",
      newValue: { arrangement: [data.tier1.arrangement, data.tier2.arrangement] },
      changedBy: userId,
    });
    return NextResponse.json({ data: doc, warnings });
  } catch (e) {
    const { status, message } = toHttpError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
