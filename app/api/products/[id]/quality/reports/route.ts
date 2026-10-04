import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { requireAdmin, toHttpError } from "@/lib/auth";
import { Product } from "@/lib/models/Product";
import { LabReport } from "@/lib/models/Quality";
import { Asset } from "@/lib/models/Asset";
import { LabReportInput } from "@/lib/validators/quality";
import { writeAudit } from "@/lib/services/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    await requireAdmin();
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await dbConnect();
    const docs = await LabReport.find({ productId: id }).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ data: docs });
  } catch (e) {
    const { status, message } = toHttpError(e);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const parsed = LabReportInput.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid lab report", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    await dbConnect();
    const product = await Product.findById(id);
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const userId = (session.user as unknown as { id?: string }).id;
    let assetId: mongoose.Types.ObjectId | undefined;
    if (parsed.data.reportFile?.publicId) {
      const asset = await Asset.findOneAndUpdate(
        { publicId: parsed.data.reportFile.publicId },
        {
          $set: {
            secureUrl: parsed.data.reportFile.secureUrl,
            purpose: "lab_report",
            deliveryType: "authenticated",
            visibility: "private",
            ownerModel: "LabReport",
            uploadedBy: userId,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      assetId = asset._id;
    }
    const doc = await LabReport.create({
      productId: id,
      labName: parsed.data.labName,
      reportNumber: parsed.data.reportNumber,
      overallResult: parsed.data.overallResult,
      accreditation: parsed.data.accreditation,
      reviewedBy: parsed.data.reviewedBy?.trim() || undefined,
      reviewerDesignation: parsed.data.reviewerDesignation?.trim() || undefined,
      signOffDate: parsed.data.signOffDate ? new Date(parsed.data.signOffDate) : undefined,
      reportFile: assetId,
      dataSource: parsed.data.dataSource?.trim() || undefined,
      createdBy: userId,
      updatedBy: userId,
    });
    await writeAudit({
      entity: "LabReport",
      entityId: doc._id,
      field: "create",
      newValue: { labName: doc.labName, reportNumber: doc.reportNumber },
      changedBy: userId,
    });
    return NextResponse.json({ data: doc }, { status: 201 });
  } catch (e) {
    const { status, message } = toHttpError(e);
    if ((e as { code?: number }).code === 11000) {
      return NextResponse.json({ error: "Duplicate report (same product, lab, number)" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status });
  }
}
