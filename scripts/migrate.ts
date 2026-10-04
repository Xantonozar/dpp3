import { dbConnect } from "../lib/db";

export async function migrate() {
  await dbConnect();
  const { User } = await import("../lib/models/User");
  const { DropdownOption } = await import("../lib/models/DropdownOption");
  const { SizeSystem } = await import("../lib/models/SizeSystem");
  const { Asset } = await import("../lib/models/Asset");
  const { AuditLog } = await import("../lib/models/AuditLog");
  const { Product } = await import("../lib/models/Product");
  const { Variant } = await import("../lib/models/Variant");
  const { Materials } = await import("../lib/models/Materials");
  const { Facility } = await import("../lib/models/Facility");
  const { Traceability } = await import("../lib/models/Traceability");
  const { Packaging } = await import("../lib/models/Packaging");
  const { EmissionFactor } = await import("../lib/models/EmissionFactor");
  const { Environmental } = await import("../lib/models/Environmental");
  const { TestCatalog, Substance, RSLProfile, LabReport, TestResult } = await import("../lib/models/Quality");
  const { CertCatalog, CertRecord } = await import("../lib/models/Certification");
  const { PublishedDpp, ScanLog } = await import("../lib/models/PublishedDpp");
  for (const m of [User, DropdownOption, SizeSystem, Asset, AuditLog, Product, Variant, Materials, Facility, Traceability, Packaging, EmissionFactor, Environmental, TestCatalog, Substance, RSLProfile, LabReport, TestResult, CertCatalog, CertRecord, PublishedDpp, ScanLog]) {
    await m.syncIndexes();
  }
  return { ok: true, synced: ["User", "DropdownOption", "SizeSystem", "Asset", "AuditLog", "Product", "Variant", "Materials", "Facility", "Traceability", "Packaging", "EmissionFactor", "Environmental", "TestCatalog", "Substance", "RSLProfile", "LabReport", "TestResult", "CertCatalog", "CertRecord", "PublishedDpp", "ScanLog"] };
}

const isMain = process.argv[1]?.endsWith("migrate.ts");
if (isMain) {
  migrate().then(
    (r) => {
      console.log(JSON.stringify(r));
      process.exit(0);
    },
    (e) => {
      console.error(e);
      process.exit(1);
    }
  );
}
