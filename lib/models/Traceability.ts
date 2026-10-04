import mongoose, { Schema } from "mongoose";
import { recordMeta } from "./_shared";

export const TIER1_PROCESSES = ["cutting", "sewing", "garment_finishing"] as const;
export const TIER2_PROCESSES = ["knitting", "dyeing", "printing", "fabric_finishing"] as const;

export const PROCESS_LABELS: Record<string, string> = {
  cutting: "Cutting",
  sewing: "Sewing",
  garment_finishing: "Garment Finishing",
  knitting: "Knitting",
  dyeing: "Dyeing",
  printing: "Printing",
  fabric_finishing: "Fabric Finishing",
};

const FacilityGroup = new Schema(
  {
    facilityId: { type: Schema.Types.ObjectId, ref: "Facility" },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    location: { type: String, required: true, trim: true, maxlength: 200 },
    processes: {
      type: [String],
      enum: ["cutting", "sewing", "garment_finishing", "knitting", "dyeing", "printing", "fabric_finishing"],
      default: [],
    },
    processStatus: {
      type: String,
      enum: ["Assigned", "Unknown", "Not disclosed"],
      default: "Assigned",
    },
  },
  { _id: true }
);

const YarnCard = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    location: { type: String, required: true, trim: true, maxlength: 200 },
    country: { type: String, required: true, trim: true, maxlength: 120 },
    yarnType: { type: String, trim: true, maxlength: 80 },
    yarnCount: { type: String, trim: true, maxlength: 60 },
    composition: { type: String, trim: true, maxlength: 200 },
    referenceLot: { type: String, trim: true, maxlength: 120 },
  },
  { _id: true }
);

const TraceabilitySchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    originDestination: {
      countryOfManufacture: { type: String, trim: true, maxlength: 120 },
      finalFactory: { type: String, trim: true, maxlength: 200 },
      finalFactoryLocation: { type: String, trim: true, maxlength: 200 },
      destinationCountry: { type: String, trim: true, maxlength: 120 },
      destinationMarket: { type: String, trim: true, maxlength: 120 },
      buyerBrand: { type: String, trim: true, maxlength: 120 },
    },
    tier1: {
      arrangement: { type: String, enum: ["same", "different", "mixed"] },
      facilities: { type: [FacilityGroup], default: [] },
    },
    tier2: {
      arrangement: { type: String, enum: ["same", "different", "mixed"] },
      printingStatus: {
        type: String,
        enum: ["Performed", "Not performed", "Unknown"],
      },
      facilities: { type: [FacilityGroup], default: [] },
    },
    tier3: {
      yarnManufacturers: { type: [YarnCard], default: [] },
    },
    ...recordMeta,
  },
  { timestamps: true }
);

TraceabilitySchema.index({ productId: 1 }, { unique: true });
TraceabilitySchema.index({ "tier1.facilities.facilityId": 1 });
TraceabilitySchema.index({ "tier2.facilities.facilityId": 1 });

export const Traceability =
  mongoose.models.Traceability ||
  mongoose.model("Traceability", TraceabilitySchema);
