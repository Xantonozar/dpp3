import mongoose from "mongoose";
import { customAlphabet } from "nanoid";
import { Product } from "../models/Product";
import { Variant } from "../models/Variant";
import { Materials } from "../models/Materials";
import { Traceability } from "../models/Traceability";
import { LabReport, TestResult, TestCatalog, Substance } from "../models/Quality";
import { Packaging } from "../models/Packaging";
import { Environmental } from "../models/Environmental";
import { CertCatalog, CertRecord } from "../models/Certification";
import { Facility } from "../models/Facility";
import { DropdownOption } from "../models/DropdownOption";
import { SizeSystem } from "../models/SizeSystem";

export type SectorCheck = { sector: string; saved: boolean; detail: string; missing: string[] };

type AnyDoc = Record<string, unknown>;

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export async function publishChecks(productId: string): Promise<{ checks: SectorCheck[]; canPublish: boolean }> {
  const pid = new mongoose.Types.ObjectId(productId);
  const [product, variantCount, materials, traceability, publishedCount, resultCount, packaging, environmental, certCount] =
    await Promise.all([
      Product.findById(pid).lean(),
      Variant.countDocuments({ productId: pid, active: true }),
      Materials.findOne({ productId: pid }).lean(),
      Traceability.findOne({ productId: pid }).lean(),
      TestResult.countDocuments({ productId: pid, published: true }),
      TestResult.countDocuments({ productId: pid }),
      Packaging.findOne({ productId: pid }).lean(),
      Environmental.findOne({ productId: pid }).lean(),
      CertRecord.countDocuments({ productId: pid, archivedAt: null }),
    ]);
  const checks: SectorCheck[] = [
    {
      sector: "01 Variants",
      saved: !!product && variantCount > 0,
      detail: `${variantCount} active variant(s)`,
      missing: !product
        ? ["Product not found."]
        : variantCount === 0
          ? ["Add at least one color with sizes (Sector 1)."]
          : [],
    },
    {
      sector: "02 Materials",
      saved: !!materials,
      detail: materials
        ? `Composition ${((materials as AnyDoc).mainFabric as AnyDoc)?.compositionTotal as number}%`
        : "Not saved",
      missing: materials ? [] : ["Save materials with a 100% composition (Sector 2)."],
    },
    {
      sector: "03 Traceability",
      saved: !!traceability,
      detail: traceability ? "Saved" : "Not saved (optional)",
      missing: [],
    },
    {
      sector: "04 Quality",
      saved: resultCount > 0,
      detail: `${publishedCount} published of ${resultCount} result(s)`,
      missing: [],
    },
    {
      sector: "05 Packaging",
      saved: !!packaging,
      detail: packaging ? "Saved" : "Not saved (optional)",
      missing: [],
    },
    {
      sector: "06 Environment",
      saved: !!environmental,
      detail: environmental
        ? `${((environmental as AnyDoc).results as AnyDoc)?.carbonKgCo2e as number} kg CO₂e`
        : "Not saved (optional)",
      missing: [],
    },
    {
      sector: "07 Certification",
      saved: certCount > 0,
      detail: `${certCount} record(s)`,
      missing: [],
    },
  ];
  const canPublish = checks[0].saved && checks[1].saved;
  return { checks, canPublish };
}

/**
 * Builds the public snapshot. Whitelist only: no drafts, internal notes,
 * user emails, private files, GTINs, or unapproved evidence.
 */
export async function buildSnapshot(productId: string): Promise<Record<string, unknown>> {
  const pid = new mongoose.Types.ObjectId(productId);
  const [product, variants, materials, traceability, reports, results, packaging, environmental, certs, tests, substances, catalogs, facilities, options, sizeSystems] =
    await Promise.all([
      Product.findById(pid).lean(),
      Variant.find({ productId: pid, active: true }).sort({ sizeKey: 1 }).lean(),
      Materials.findOne({ productId: pid }).lean(),
      Traceability.findOne({ productId: pid }).lean(),
      LabReport.find({ productId: pid }).lean(),
      TestResult.find({ productId: pid, published: true }).sort({ createdAt: -1 }).lean(),
      Packaging.findOne({ productId: pid }).lean(),
      Environmental.findOne({ productId: pid }).lean(),
      CertRecord.find({ productId: pid, archivedAt: null }).sort({ updatedAt: -1 }).lean(),
      TestCatalog.find({}).lean(),
      Substance.find({}).lean(),
      CertCatalog.find({}).lean(),
      Facility.find({}).lean(),
      DropdownOption.find({}).lean(),
      SizeSystem.find({}).lean(),
    ]);
  if (!product) throw Object.assign(new Error("Product not found."), { status: 404 });
  const p = product as unknown as {
    productId: string;
    name?: string;
    styleNo?: string;
    productType?: string;
    buyerBrand?: string;
    sizeSystemKey?: string;
    colors: { _id: unknown; name: string; colorCode?: string; images: { secureUrl?: string; altText?: string }[] }[];
  };
  const labelOf = (list: string, code?: string, other?: string) => {
    if (!code) return "";
    if (code === "other") return other?.trim() || "Other";
    const hit = (options as unknown as { list: string; code: string; label: string }[]).find(
      (o) => o.list === list && o.code === code
    );
    return hit?.label ?? code;
  };
  const colorName = (cid: unknown) =>
    p.colors.find((c) => String(c._id) === String(cid))?.name ?? "";
  const sizeLabel = (key: string) => {
    for (const s of sizeSystems as unknown as { options: { key: string; label: string }[] }[]) {
      const hit = s.options.find((o) => o.key === key);
      if (hit) return hit.label;
    }
    return key;
  };
  const testById = new Map((tests as unknown as { testId: string; name: string; shortSummary?: string; methods: { label?: string }[] }[]).map((t) => [t.testId, t]));
  const subByKey = new Map(
    (substances as unknown as { key: string; name: string; isGroup?: boolean; casNumbers: string[] }[]).map((s) => [s.key, s])
  );
  const reportById = new Map(
    (reports as unknown as { _id: unknown; labName: string; reportNumber: string; accreditation?: { body?: string; certificateRef?: string } }[]).map((r) => [
      String(r._id),
      r,
    ])
  );
  const catName = new Map(
    (catalogs as unknown as { catalogId: string; displayName?: string; officialName?: string }[]).map((c) => [
      c.catalogId,
      c.displayName ?? c.officialName ?? c.catalogId,
    ])
  );
  const facById = new Map(
    (facilities as unknown as { _id: unknown; name: string; location: string }[]).map((f) => [String(f._id), f])
  );

  const m = materials as unknown as null | {
    mainFabric: { fabricType?: { code: string; other?: string }; fibers: { fiberCode: string; otherName?: string; percentage: number }[]; gsm?: number; construction?: string };
    trims: { componentCode: string; otherName?: string; materialType?: string }[];
  };
  const t = traceability as unknown as null | {
    originDestination: Record<string, string>;
    tier1: { facilities: { name: string; location: string; processes: string[]; processStatus: string }[] };
    tier2: { printingStatus?: string; facilities: { name: string; location: string; processes: string[]; processStatus: string }[] };
    tier3: { yarnManufacturers: { name: string; location: string; country: string }[] };
  };
  const e = environmental as unknown as null | {
    inputs: { gridSharePct: number; solarSharePct: number };
    emissionFactors: { gridValue: number; solarValue: number; source: string; yearVersion: string };
    results: { fabricRequiredKg: number; totalEnergyKwh: number; gridEnergyKwh: number; solarEnergyKwh: number; carbonKgCo2e: number };
  };
  const pk = packaging as unknown as null | {
    packagingType: { code: string; other?: string };
    packagingMaterials: { code: string; other?: string }[];
    recycledContentPercent: number | null;
    recycledContentStatus: string;
    recyclability?: string;
    disposalReuseInstructions?: string;
  };

  const tierRows: { tier: string; process: string; factory: string; location: string; note: string }[] = [];
  if (t) {
    const find = (groups: { name: string; location: string; processes: string[]; processStatus: string }[], pr: string) =>
      groups.find((g) => g.processes.includes(pr));
    for (const [key, lab] of [["cutting", "Cutting"], ["sewing", "Sewing"], ["garment_finishing", "Garment Finishing"]] as [string, string][]) {
      const g = find(t.tier1.facilities ?? [], key);
      tierRows.push({
        tier: "Tier 1", process: lab,
        factory: g?.name ?? "—", location: g?.location ?? "—",
        note: !g ? "Unknown" : g.processStatus !== "Assigned" ? g.processStatus : "",
      });
    }
    for (const [key, lab] of [["knitting", "Knitting"], ["dyeing", "Dyeing"], ["printing", "Printing"], ["fabric_finishing", "Fabric Finishing"]] as [string, string][]) {
      if (key === "printing" && t.tier2.printingStatus === "Not performed") {
        tierRows.push({ tier: "Tier 2", process: lab, factory: "—", location: "—", note: "Not performed" });
        continue;
      }
      const g = find(t.tier2.facilities ?? [], key);
      tierRows.push({
        tier: "Tier 2", process: lab,
        factory: g?.name ?? "—", location: g?.location ?? "—",
        note: !g ? "Unknown" : g.processStatus !== "Assigned" ? g.processStatus : "",
      });
    }
  }

  const quality = (
    results as unknown as {
      kind: string; testId?: string; substanceKey?: string; methodId?: string;
      resultState: string; result: Record<string, unknown>; reportingLimit?: number;
      unit?: string; testDate?: string; component?: string; status: string;
      criterionSnapshot?: { operator: string; value: number; unit: string };
      labReportId?: unknown;
      rslProfile?: { key: string; version: string };
    }[]
  ).map((r) => {
    const rep = r.labReportId ? reportById.get(String(r.labReportId)) : undefined;
    const labLine =
      rep && rep.accreditation?.body && rep.accreditation?.certificateRef ? "Accredited" : rep ? "Report provided" : "";
    if (r.kind === "physical") {
      const test = r.testId ? testById.get(r.testId) : undefined;
      return {
        kind: "physical",
        name: test?.name ?? r.testId ?? "Test",
        method: test?.methods?.[0]?.label ?? r.methodId ?? "",
        breakdown: Object.entries(r.result ?? {}).map(([k, v]) => `${k}: ${String(v)}`).join(" · "),
        status: r.status,
        criterion: r.criterionSnapshot
          ? `${r.criterionSnapshot.operator} ${r.criterionSnapshot.value} ${r.criterionSnapshot.unit ?? ""}`.trim()
          : "Result recorded - criterion not configured",
        testDate: r.testDate ? str(r.testDate).slice(0, 10) : "",
        reportRef: rep ? `${rep.labName} · ${rep.reportNumber}` : "",
        labLine,
      };
    }
    const s = r.substanceKey ? subByKey.get(r.substanceKey) : undefined;
    return {
      kind: "chemical",
      name: s?.name ?? r.substanceKey ?? "Substance",
      cas: s && !s.isGroup && s.casNumbers.length > 0 ? s.casNumbers.join(", ") : "Multiple - see substance list",
      value: r.resultState === "ND" ? `ND (<${r.reportingLimit})` : String(Object.values(r.result ?? {})[0] ?? r.resultState),
      unit: r.unit ?? "",
      status: r.status,
      criterion: r.criterionSnapshot
        ? `${r.criterionSnapshot.operator} ${r.criterionSnapshot.value} ${r.criterionSnapshot.unit ?? ""}`.trim()
        : "Result recorded - criterion not configured",
      component: r.component ?? "",
    };
  });

  return {
    header: {
      name: p.name ?? p.productId,
      productId: p.productId,
      styleNo: p.styleNo ?? "",
      productType: p.productType ?? "",
      buyerBrand: p.buyerBrand ?? "",
      colors: p.colors.map((c) => ({
        name: c.name,
        images: (c.images ?? []).map((im) => ({ url: im.secureUrl ?? "", alt: im.altText ?? c.name })),
      })),
      sizes: [...new Set((variants as unknown as { sizeKey: string }[]).map((v) => v.sizeKey))].map((s) => ({ key: s, label: sizeLabel(s) })),
      variants: (variants as unknown as { _id: unknown; colorId: unknown; sizeKey: string }[]).map((v) => ({
        vid: String(v._id),
        color: colorName(v.colorId),
        size: sizeLabel(v.sizeKey),
      })),
    },
    materials: m
      ? {
          fabricType: labelOf("fabric_type", m.mainFabric.fabricType?.code, m.mainFabric.fabricType?.other),
          fibers: m.mainFabric.fibers.map((f) => ({
            label: labelOf("fiber_type", f.fiberCode, f.otherName),
            percentage: f.percentage,
          })),
          gsm: m.mainFabric.gsm ?? null,
          construction: m.mainFabric.construction ?? "",
          trims: m.trims.map((x) => ({
            label: labelOf("trim_component", x.componentCode, x.otherName),
            material: x.materialType ?? "",
          })),
        }
      : null,
    traceability: t
      ? {
          origin: {
            countryOfManufacture: t.originDestination?.countryOfManufacture ?? "",
            finalFactory: t.originDestination?.finalFactory ?? "",
            finalFactoryLocation: t.originDestination?.finalFactoryLocation ?? "",
            destinationCountry: t.originDestination?.destinationCountry ?? "",
            destinationMarket: t.originDestination?.destinationMarket ?? "",
          },
          tiers: tierRows,
          yarn: (t.tier3?.yarnManufacturers ?? []).map((y) => ({ name: y.name, location: y.location, country: y.country })),
        }
      : null,
    quality,
    packaging: pk
      ? {
          type: labelOf("packaging_type", pk.packagingType?.code, pk.packagingType?.other),
          materials: pk.packagingMaterials.map((x) => labelOf("packaging_material", x.code, x.other)),
          recycledContent: pk.recycledContentPercent != null ? `${pk.recycledContentPercent}%` : "Not available",
          recyclability: pk.recyclability ?? "Not available",
          instructions: pk.disposalReuseInstructions ?? "",
        }
      : null,
    environmental: e
      ? {
          totalEnergyKwh: e.results.totalEnergyKwh,
          gridEnergyKwh: e.results.gridEnergyKwh,
          solarEnergyKwh: e.results.solarEnergyKwh,
          gridSharePct: e.inputs.gridSharePct,
          solarSharePct: e.inputs.solarSharePct,
          carbonKgCo2e: e.results.carbonKgCo2e,
          factors: { grid: e.emissionFactors.gridValue, solar: e.emissionFactors.solarValue },
          breakdown: `Fabric ${e.results.fabricRequiredKg} kg · factors from ${e.emissionFactors.source} (${e.emissionFactors.yearVersion})`,
        }
      : null,
    certification: (
      certs as unknown as {
        catalogId: string; recordType: string; scopeText: string; tierStage?: string;
        relatedEntityId?: unknown; status: string; complianceOutcome?: string;
        requirementName?: string; issueDate?: string; expiryDate?: string;
        assessmentDate?: string; evidenceUrl?: string; publicEvidenceApproved?: boolean;
      }[]
    ).map((r) => {
      const f = r.relatedEntityId ? facById.get(String(r.relatedEntityId)) : undefined;
      return {
        name: catName.get(r.catalogId) ?? r.catalogId,
        recordType: r.recordType,
        scope: r.scopeText,
        tier: r.tierStage ?? "",
        facility: f ? `${f.name} — ${f.location}` : "",
        status: r.status,
        outcome: r.complianceOutcome ?? "",
        requirement: r.requirementName ?? "",
        issueDate: r.issueDate ? str(r.issueDate).slice(0, 10) : "",
        expiryDate: r.expiryDate ? str(r.expiryDate).slice(0, 10) : "",
        assessmentDate: r.assessmentDate ? str(r.assessmentDate).slice(0, 10) : "",
        evidenceUrl: r.publicEvidenceApproved ? (r.evidenceUrl ?? "") : "",
      };
    }),
  };
}

export async function recordScan(productId: string, shortCode: string, country?: string) {
  const { ScanLog } = await import("../models/PublishedDpp");
  try {
    await ScanLog.create({ productId, shortCode, country });
  } catch {
    // scan counting never breaks the public page
  }
}

const nanoid10 = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", 10);

async function uniqueCode(): Promise<string> {
  const { PublishedDpp } = await import("../models/PublishedDpp");
  for (let i = 0; i < 5; i++) {
    const code = nanoid10();
    if (!(await PublishedDpp.findOne({ shortCode: code }).lean())) return code;
  }
  throw Object.assign(new Error("Could not mint a short code."), { status: 500 });
}

/**
 * Publish (or republish) a product: same shortCode, version + 1, old
 * snapshots deactivated but kept. Throws 422 when checks fail.
 */
export async function publishProduct(productId: string, userId?: string) {
  const { PublishedDpp } = await import("../models/PublishedDpp");
  const { writeAudit } = await import("./audit");
  const product = await Product.findById(productId);
  if (!product) throw Object.assign(new Error("Product not found."), { status: 404 });
  const { checks, canPublish } = await publishChecks(productId);
  if (!canPublish) {
    throw Object.assign(new Error("Not ready to publish."), {
      status: 422,
      missing: checks.flatMap((c) => c.missing),
    });
  }
  const snapshot = await buildSnapshot(productId);
  const existing = await PublishedDpp.findOne({ productId }).sort({ version: -1 });
  const shortCode = existing
    ? (existing as unknown as { shortCode: string }).shortCode
    : await uniqueCode();
  const version = existing ? ((existing as unknown as { version: number }).version + 1) : 1;
  // deactivate first: the live-code index is partial-unique on active docs
  await PublishedDpp.updateMany({ productId }, { $set: { active: false } });
  const doc = await PublishedDpp.create({
    productId,
    shortCode,
    version,
    snapshot,
    publishedBy: userId,
    publishedAt: new Date(),
    active: true,
  });
  await writeAudit({
    entity: "PublishedDpp",
    entityId: doc._id,
    field: "publish",
    newValue: { shortCode, version },
    changedBy: userId as unknown as mongoose.Types.ObjectId | undefined,
  });
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  return { shortCode, version, url: `${base}/p/${shortCode}` };
}
