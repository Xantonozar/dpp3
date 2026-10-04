import mongoose from "mongoose";
import { Variant } from "../models/Variant";

export type SyncRow = {
  colorId: string;
  sizeKey: string;
  gtin?: string;
  gtinStatus?: string;
};

/** Derived live count — never stored. */
export async function countActiveVariants(
  productId: mongoose.Types.ObjectId | string,
  colorId?: string
) {
  const filter: Record<string, unknown> = { productId, active: true };
  if (colorId) filter.colorId = colorId;
  return Variant.countDocuments(filter);
}

/**
 * Diff-sync selected sizes + GTINs for all colors.
 * - payload rows become active (restore archivedGtin when re-selected with blank GTIN)
 * - existing active pairs absent from payload are archived (GTIN moved to archivedGtin)
 * - duplicate non-empty GTINs across the product are rejected before commit
 */
export async function syncVariants(
  productId: mongoose.Types.ObjectId | string,
  rows: SyncRow[],
  opts: { final?: boolean } = {}
) {
  const key = (c: string, s: string) => `${c}|||${s}`;
  const wanted = new Map(rows.map((r) => [key(r.colorId, r.sizeKey), r]));

  // duplicate GTIN check before commit (trimmed, non-empty)
  const gtins = rows
    .map((r) => (r.gtin ?? "").trim())
    .filter((g) => g !== "");
  const dup = gtins.find((g, i) => gtins.indexOf(g) !== i);
  if (dup) {
    throw Object.assign(new Error(`Duplicate GTIN: ${dup}`), { status: 409 });
  }
  if (opts.final && rows.length === 0) {
    throw Object.assign(
      new Error("Final save needs at least one active variant"),
      { status: 422 }
    );
  }

  const session = await mongoose.startSession();
  try {
    const result: { activated: number; archived: number } = {
      activated: 0,
      archived: 0,
    };
    await session.withTransaction(async () => {
      const existing = await Variant.find({ productId }).session(session);
      const existingByKey = new Map(
        existing.map((v) => [
          key(String(v.colorId), v.sizeKey),
          v,
        ])
      );

      for (const row of rows) {
        const found = existingByKey.get(key(row.colorId, row.sizeKey));
        const gtin = (row.gtin ?? "").trim() || undefined;
        if (found) {
          found.active = true;
          found.archivedAt = undefined;
          if (gtin !== undefined) {
            found.gtin = gtin;
            found.archivedGtin = undefined;
          } else if (found.archivedGtin && !found.gtin) {
            // re-select restores archived GTIN
            found.gtin = found.archivedGtin;
            found.archivedGtin = undefined;
          }
          if (row.gtinStatus) found.gtinStatus = row.gtinStatus as never;
          else if (!found.gtin) found.gtinStatus = "GTIN Pending" as never;
          await found.save({ session });
          result.activated++;
        } else {
          await Variant.create(
            [
              {
                productId,
                colorId: row.colorId,
                sizeKey: row.sizeKey,
                gtin,
                gtinStatus: row.gtinStatus ?? "GTIN Pending",
                active: true,
              },
            ],
            { session }
          );
          result.activated++;
        }
      }

      for (const v of existing) {
        if (!v.active) continue;
        if (!wanted.has(key(String(v.colorId), v.sizeKey))) {
          v.active = false;
          v.archivedAt = new Date();
          if (v.gtin) {
            v.archivedGtin = v.gtin;
            v.gtin = undefined;
          }
          v.gtinStatus = "Archived" as never;
          await v.save({ session });
          result.archived++;
        }
      }
    });
    return result;
  } catch (e) {
    if ((e as { code?: number }).code === 11000) {
      throw Object.assign(new Error("Duplicate GTIN or color+size"), {
        status: 409,
      });
    }
    throw e;
  } finally {
    await session.endSession();
  }
}
