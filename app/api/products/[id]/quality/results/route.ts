import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { requireAdmin, toHttpError } from "@/lib/auth";
import { Product } from "@/lib/models/Product";
import { TestCatalog, Substance, RSLProfile, TestResult } from "@/lib/models/Quality";
import { TestResultInput } from "@/lib/validators/quality";
import { testEvaluator, type Criterion, type SchemaField } from "@/lib/services/testEvaluator";
import { writeAudit } from "@/lib/services/audit";

type Ctx = { params: Promise<{ id: string }> };

type LeanCriterion = {
  kind: string;
  refKey: string;
  operator: "<=" | "<" | ">=" | ">" | "range";
  value: number;
  valueMax?: number;
  unit: string;
  methodId?: string;
};

function findCriterion(
  profile: { criteria?: LeanCriterion[] } | null,
  kind: "physical" | "chemical",
  refKey?: string,
  unit?: string
): { criterion: Criterion | null; snapshot: unknown } {
  if (!profile?.criteria?.length || !refKey) return { criterion: null, snapshot: null };
  const wantKind = kind === "physical" ? "test" : "substance";
  const cands = profile.criteria.filter((c) => c.kind === wantKind && c.refKey === refKey);
  if (cands.length === 0) return { criterion: null, snapshot: null };
  // prefer a unit-compatible criterion, else the first (evaluator reports mismatch)
  const u = (unit ?? "").toLowerCase();
  const pick =
    cands.find((c) => (c.unit ?? "").toLowerCase() === u) ?? cands[0];
  return {
    criterion: {
      operator: pick.operator,
      value: pick.value,
      valueMax: pick.valueMax,
      unit: pick.unit,
      methodId: pick.methodId,
    },
    snapshot: pick,
  };
}

export async function GET(req: Request, { params }: Ctx) {
  try {
    await requireAdmin();
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await dbConnect();
    const kind = new URL(req.url).searchParams.get("kind") ?? "";
    const filter: Record<string, unknown> = { productId: id };
    if (kind) filter.kind = kind;
    const docs = await TestResult.find(filter).sort({ createdAt: -1 }).lean();
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
    const parsed = TestResultInput.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid result", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const d = parsed.data;
    if (d.kind === "physical" && !d.testId) {
      return NextResponse.json({ error: "Select a test." }, { status: 400 });
    }
    if (d.kind === "chemical" && !d.substanceKey) {
      return NextResponse.json({ error: "Select a substance." }, { status: 400 });
    }
    if (d.labReportId && !mongoose.isValidObjectId(d.labReportId)) {
      return NextResponse.json({ error: "Invalid lab report." }, { status: 400 });
    }
    await dbConnect();
    const product = await Product.findById(id);
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // catalog lookups (limits come from the profile only — never from this form)
    const [test, substance, profile] = await Promise.all([
      d.testId ? TestCatalog.findOne({ testId: d.testId }).lean() : null,
      d.substanceKey ? Substance.findOne({ key: d.substanceKey }).lean() : null,
      d.rslProfile
        ? RSLProfile.findOne({ key: d.rslProfile.key, version: d.rslProfile.version }).lean()
        : null,
    ]);
    const schema = ((test as unknown as { resultSchema?: SchemaField[] } | null)?.resultSchema ?? []) as SchemaField[];
    if (d.testId && !test) {
      return NextResponse.json({ error: "Unknown test." }, { status: 400 });
    }
    if (d.substanceKey && !substance) {
      return NextResponse.json({ error: "Unknown substance." }, { status: 400 });
    }
    const { criterion, snapshot } = findCriterion(
      profile as unknown as { criteria?: LeanCriterion[] } | null,
      d.kind,
      d.kind === "physical" ? d.testId : d.substanceKey,
      d.unit
    );
    const { status, message } = testEvaluator({
      kind: d.kind,
      resultState: d.resultState ?? "Value",
      result: d.result as Record<string, unknown>,
      resultSchema: schema,
      reportingLimit: d.reportingLimit,
      unit: d.unit,
      methodId: d.methodId,
      criterion,
    });

    const userId = (session.user as unknown as { id?: string }).id;
    const doc = await TestResult.create({
      productId: id,
      labReportId: d.labReportId || undefined,
      kind: d.kind,
      testId: d.testId,
      substanceKey: d.substanceKey,
      methodId: d.methodId,
      methodEdition: d.methodEdition,
      descriptionId: d.descriptionId,
      resultState: d.resultState,
      result: d.result,
      reportingLimit: d.reportingLimit,
      unit: d.unit,
      scale: d.scale,
      testDate: d.testDate ? new Date(d.testDate) : undefined,
      sampleLocation: d.sampleLocation?.trim() || undefined,
      component: d.component?.trim() || undefined,
      rslProfile: d.rslProfile,
      criterionSnapshot: snapshot,
      status,
      published: d.published,
      dataSource: d.dataSource?.trim() || undefined,
      createdBy: userId,
      updatedBy: userId,
    });
    await writeAudit({
      entity: "TestResult",
      entityId: doc._id,
      field: "create",
      newValue: { kind: d.kind, status, message },
      changedBy: userId,
    });
    return NextResponse.json({ data: doc, evaluation: message }, { status: 201 });
  } catch (e) {
    const { status, message } = toHttpError(e);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = (await req.json()) as { _id?: string; published?: boolean };
    if (!body._id || !mongoose.isValidObjectId(body._id)) {
      return NextResponse.json({ error: "Invalid result id." }, { status: 400 });
    }
    await dbConnect();
    // only the published flag is editable post-save (values are immutable history)
    const doc = await TestResult.findOneAndUpdate(
      { _id: body._id, productId: id },
      { $set: { published: body.published ?? false } },
      { new: true }
    );
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await writeAudit({
      entity: "TestResult",
      entityId: doc._id,
      field: "published",
      newValue: { published: doc.published },
      changedBy: (session.user as unknown as { id?: string }).id,
    });
    return NextResponse.json({ data: doc });
  } catch (e) {
    const { status, message } = toHttpError(e);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const rid = new URL(req.url).searchParams.get("rid") ?? "";
    if (!mongoose.isValidObjectId(rid)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await dbConnect();
    const doc = await TestResult.findOneAndDelete({ _id: rid, productId: id });
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await writeAudit({
      entity: "TestResult",
      entityId: doc._id,
      field: "delete",
      changedBy: (session.user as unknown as { id?: string }).id,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const { status, message } = toHttpError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
