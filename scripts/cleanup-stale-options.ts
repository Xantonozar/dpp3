import { dbConnect } from "../lib/db";
import { LISTS } from "./seed";
import { DropdownOption } from "../lib/models/DropdownOption";

// One-time cleanup: remove superseded dropdown codes from an older seed
// convention. Keeps exactly the codes the current seed writes. Does NOT
// touch admin-added options with distinct labels (none existed).
async function main() {
  await dbConnect();
  let n = 0;
  for (const [list, opts] of Object.entries(LISTS)) {
    const keep = new Set(opts.map((o) => o.code));
    const res = await DropdownOption.deleteMany({ list, code: { $nin: [...keep] } });
    if (res.deletedCount > 0) console.log(`${list}: removed ${res.deletedCount}`);
    n += res.deletedCount;
  }
  console.log("deleted stale total:", n);
  const { Packaging } = await import("../lib/models/Packaging");
  const { CertRecord } = await import("../lib/models/Certification");
  const { Traceability } = await import("../lib/models/Traceability");
  console.log("packaging:", await Packaging.countDocuments());
  console.log("certs:", await CertRecord.countDocuments());
  console.log("trace:", await Traceability.countDocuments());
  console.log("yarn_opts:", await DropdownOption.countDocuments({ list: "yarn_type" }));
  const mongoose = (await import("mongoose")).default;
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
