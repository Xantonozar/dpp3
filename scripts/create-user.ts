import bcrypt from "bcryptjs";
import { dbConnect } from "../lib/db";
import { User } from "../lib/models/User";

export async function createUser(
  email = process.env.ADMIN_EMAIL ?? "",
  password = process.env.ADMIN_PASSWORD ?? "",
  name = process.env.ADMIN_NAME ?? "Admin"
) {
  if (!email || !password) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD env vars");
  }
  await dbConnect();
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.findOneAndUpdate(
    { email: email.toLowerCase().trim() },
    { $set: { name, passwordHash, role: "admin", active: true } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return { ok: true, email: user.email };
}

const isMain = process.argv[1]?.endsWith("create-user.ts");
if (isMain) {
  createUser().then(
    (r) => {
      console.log(JSON.stringify(r));
      process.exit(0);
    },
    (e) => {
      console.error(e.message);
      process.exit(1);
    }
  );
}
