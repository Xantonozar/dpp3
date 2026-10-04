import { describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { validateCertRecord, certCounters } from "@/lib/services/certStatus";
import type { CertData } from "@/lib/services/certStatus";

const cert: CertData = {
  catalogId: "03",
  recordType: "Certification",
  scopeText: "Organic cotton knitting and sewing",
  documentNumber: "GOTS-123",
  issuer: "Control Union",
  issueDate: "2024-01-01",
  expiryDate: "2025-01-01",
  noStatedExpiry: false,
  status: "Verified",
  evidenceType: "Certificate",
  evidenceUrl: "https://example.com/cert.pdf",
  publicEvidenceApproved: false,
  linkProduct: false,
};

describe("certStatus rules (Phase 8 gates)", () => {
  it("P8-T06: expiry before issue blocked", () => {
    expect(() =>
      validateCertRecord({ ...cert, issueDate: "2025-01-01", expiryDate: "2024-01-01" })
    ).toThrow(expect.objectContaining({ status: 422 }));
  });
  it("P8-T07: past expiry changes nothing (no Expired status)", () => {
    const r = validateCertRecord({ ...cert, issueDate: "2020-01-01", expiryDate: "2021-01-01" });
    expect(r.warnings).toEqual([]);
  });
  it("P8-T10/T29: Compliant needs requirement + assessment date", () => {
    expect(() =>
      validateCertRecord({ ...cert, complianceOutcome: "Compliant" })
    ).toThrow(expect.objectContaining({ status: 422 }));
    expect(() =>
      validateCertRecord({
        ...cert,
        complianceOutcome: "Compliant",
        requirementName: "Wastewater pH 6-9",
        requirementLimit: "pH 6-9",
        assessmentDate: "2024-06-01",
      })
    ).not.toThrow();
  });
  it("P8-T11: Not Applicable needs a reason", () => {
    expect(() => validateCertRecord({ ...cert, status: "Not Applicable" })).toThrow(
      expect.objectContaining({ status: 422 })
    );
    expect(() =>
      validateCertRecord({ ...cert, status: "Not Applicable", notApplicableReason: "No dyeing on site" })
    ).not.toThrow();
  });
  it("P8-T12: duplicate cert ID + issuer + site warns, does not block", () => {
    const r = validateCertRecord(cert, { duplicate: true });
    expect(r.warnings.length).toBe(1);
    expect(r.warnings[0]).toMatch(/distinct/);
  });
  it("P8-T14: tier/entity mismatch warns", () => {
    const r = validateCertRecord(
      { ...cert, tierStage: "Tier 1 (cutting, sewing/garment finishing)" },
      { facilityKind: "yarn" }
    );
    expect(r.warnings.length).toBe(1);
  });
  it("facility scope note warns when product not covered", () => {
    const r = validateCertRecord(
      { ...cert, relatedEntityId: "507f1f77bcf86cd799439011" },
      { productCodes: ["TSH-001"] }
    );
    expect(r.warnings.some((w) => w.includes("does not certify every garment"))).toBe(true);
  });
  it("P8-T24: Fairtrade needs scheme name and scope", () => {
    expect(() =>
      validateCertRecord({ ...cert, catalogId: "07", issuer: "" })
    ).toThrow(expect.objectContaining({ status: 422 }));
    expect(() =>
      validateCertRecord({ ...cert, catalogId: "07", issuer: "Fairtrade International" })
    ).not.toThrow();
  });
  it("conditional fields per record type", () => {
    expect(() =>
      validateCertRecord({ ...cert, recordType: "Audit/Assessment" })
    ).toThrow(/audit date/i);
    expect(() =>
      validateCertRecord({ ...cert, recordType: "Programme" })
    ).toThrow(/participation/i);
    expect(() =>
      validateCertRecord({ ...cert, recordType: "Legal/Statutory" })
    ).toThrow(/authority/i);
    expect(() =>
      validateCertRecord({ ...cert, recordType: "Product Test/Requirement" })
    ).toThrow(/test method/i);
  });
});

describe("certification seed + counters (P8-T01, T15, T20)", () => {
  it("16 stable options; counters exclude archived; one record counts once", async () => {
    const mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    const { seed } = await import("@/scripts/seed");
    await seed();
    await seed();
    const { CertCatalog, CertRecord } = await import("@/lib/models/Certification");
    expect(await CertCatalog.countDocuments()).toBe(16);
    expect(await CertCatalog.countDocuments({ catalogId: "03" })).toBe(1);
    expect(await CertRecord.countDocuments()).toBe(0);

    const pid = new mongoose.Types.ObjectId();
    const mk = (status: string, outcome: string, archived: boolean) =>
      CertRecord.create({
        catalogId: "03",
        recordType: "Certification",
        productId: pid,
        scopeText: "scope",
        status,
        complianceOutcome: outcome,
        ...(archived ? { archivedAt: new Date() } : {}),
      });
    await mk("Verified", "Compliant", false);
    await mk("Not Assessed", "Not assessed", false);
    await mk("Verified", "Compliant", true);
    const c = await certCounters(String(pid));
    expect(c.certification).toMatchObject({ Total: 2, Verified: 1, "Not Assessed": 1 });
    expect(c.compliance).toMatchObject({ Total: 2, Compliant: 1 });
    await mongoose.disconnect();
    await mongod.stop();
  }, 120_000);
});
