import fs from "fs";

// tsx doesn't auto-load env files — load before dbConnect() reads MONGODB_URI.
try {
  if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");
} catch {
  /* fall through — caller may have exported env already */
}

import { dbConnect } from "../lib/db";
import { Product } from "../lib/models/Product";
import { Variant } from "../lib/models/Variant";
import { Materials } from "../lib/models/Materials";
import { Traceability } from "../lib/models/Traceability";
import { LabReport, TestResult } from "../lib/models/Quality";
import { Packaging } from "../lib/models/Packaging";
import { Environmental } from "../lib/models/Environmental";
import { CertRecord } from "../lib/models/Certification";
import { PublishedDpp, ScanLog } from "../lib/models/PublishedDpp";
import { Asset } from "../lib/models/Asset";
import { AuditLog } from "../lib/models/AuditLog";

// Removes e2e/manual test products (TEST-* / SHOT-*) and everything linked by
// productId, plus their assets, scan logs and audit entries. Dry-run by default:
//   npm run cleanup-test-products -- --yes   actually delete
// Never touches real products, seeded catalogs, facilities or users.

const MATCH = /^(TEST-|SHOT-)/;

type Deletable = {
  label: string;
  count: (f: Record<string, unknown>) => Promise<number>;
  remove: (f: Record<string, unknown>) => Promise<{ deletedCount: number }>;
  filter: Record<string, unknown>;
};

function targets(ids: unknown[], allIds: unknown[]): Deletable[] {
  const inIds = { $in: ids };
  const t = (label: string, model: {
    countDocuments: (f: Record<string, unknown>) => PromiseLike<number>;
    deleteMany: (f: Record<string, unknown>) => PromiseLike<{ deletedCount: number }>;
  }, filter: Record<string, unknown>): Deletable => ({
    label,
    count: async (f) => model.countDocuments(f),
    remove: async (f) => model.deleteMany(f),
    filter,
  });
  return [
    t("variants", Variant, { productId: inIds }),
    t("materials", Materials, { productId: inIds }),
    t("traceability", Traceability, { productId: inIds }),
    t("lab_reports", LabReport, { productId: inIds }),
    t("test_results", TestResult, { productId: inIds }),
    t("packaging", Packaging, { productId: inIds }),
    t("environmental", Environmental, { productId: inIds }),
    t("cert_records", CertRecord, { productId: inIds }),
    t("published_dpp", PublishedDpp, { productId: inIds }),
    t("scan_logs", ScanLog, { productId: inIds }),
    t("assets", Asset, { ownerId: { $in: allIds } }),
    t("audit_logs", AuditLog, { entityId: { $in: allIds } }),
    t("products", Product, { _id: inIds }),
  ];
}

async function main() {
  const yes = process.argv.includes("--yes");
  await dbConnect();

  const products = await Product.find({ productId: { $regex: MATCH } })
    .select("_id productId name")
    .lean();
  if (products.length === 0) {
    console.log("no TEST-*/SHOT-* products found — nothing to do");
    await (await import("mongoose")).default.disconnect();
    return;
  }
  const ids = products.map((p) => p._id);
  console.log(`matched ${products.length} test product(s):`);
  for (const p of products) console.log(`  - ${p.productId} (${p.name})`);

  const variants = await Variant.find({ productId: { $in: ids } }).select("_id").lean();
  const reports = await LabReport.find({ productId: { $in: ids } }).select("_id").lean();
  const certs = await CertRecord.find({ productId: { $in: ids } }).select("_id").lean();
  const colorAssets = products.flatMap((p) =>
    ((p as unknown as { colors?: { asset?: unknown }[] }).colors ?? [])
      .map((c) => c.asset)
      .filter(Boolean)
  );
  const allIds: unknown[] = [
    ...ids,
    ...variants.map((v) => v._id),
    ...reports.map((r) => r._id),
    ...certs.map((c) => c._id),
  ];

  const ts = targets(ids, allIds);

  if (!yes) {
    console.log("\nDRY RUN — nothing deleted. Re-run with -- --yes to delete.\n");
    for (const t of ts) console.log(`${t.label}: ${await t.count(t.filter)}`);
    const orphanAssets = await Asset.countDocuments({ _id: { $in: colorAssets } });
    console.log(`color_assets (extra): ${orphanAssets}`);
    await (await import("mongoose")).default.disconnect();
    return;
  }

  // assets first (so Cloudinary publicIds are known before records vanish)
  const doomed = await Asset.find({
    $or: [{ ownerId: { $in: allIds } }, { _id: { $in: colorAssets } }],
  })
    .select("publicId")
    .lean();

  let total = 0;
  for (const t of ts) {
    const r = await t.remove(t.filter);
    total += r.deletedCount;
    console.log(`${t.label}: ${r.deletedCount}`);
  }
  const extra = await Asset.deleteMany({ _id: { $in: colorAssets } });
  total += extra.deletedCount;
  console.log(`color_assets: ${extra.deletedCount}`);
  console.log(`TOTAL: ${total}`);

  if (doomed.length && process.env.CLOUDINARY_CLOUD_NAME) {
    const { v2 } = await import("cloudinary");
    v2.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    let gone = 0;
    for (const a of doomed) {
      try {
        await v2.uploader.destroy(a.publicId);
        gone++;
      } catch {
        /* orphan file is harmless */
      }
    }
    console.log(`cloudinary destroyed: ${gone}/${doomed.length}`);
  } else {
    console.log("cloudinary: skipped (no keys or no assets)");
  }

  await (await import("mongoose")).default.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
