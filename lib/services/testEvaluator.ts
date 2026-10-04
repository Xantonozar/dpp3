export const NOT_CONFIGURED = "Result recorded - criterion not configured";

export type ResultStatus = "PASS" | "FAIL" | "REVIEW REQUIRED" | "NOT TESTED" | "NOT APPLICABLE";

export type Criterion = {
  operator: "<=" | "<" | ">=" | ">" | "range";
  value: number;
  valueMax?: number;
  unit: string;
  methodId?: string;
};

export type SchemaField = {
  key: string;
  label: string;
  type: "grade" | "number" | "text" | "enum";
  unit?: string;
  scale?: string;
  required?: boolean;
};

const GREY_GRADES = ["1", "1-2", "2", "2-3", "3", "3-4", "4", "4-5", "5"];

export function parseGrade(raw: unknown, scale?: string): number {
  const s = String(raw ?? "").trim();
  if (scale === "blue_wool_1_8") {
    const n = Number(s);
    if (!Number.isInteger(n) || n < 1 || n > 8) {
      throw Object.assign(new Error(`Invalid Blue Wool grade: ${s || "—"} (1–8).`), { status: 422 });
    }
    return n;
  }
  if (!GREY_GRADES.includes(s)) {
    throw Object.assign(
      new Error(`Invalid grey-scale grade: ${s || "—"} (1–5 with half grades).`),
      { status: 422 }
    );
  }
  if (s.includes("-")) {
    const [a, b] = s.split("-").map(Number);
    return (a + b) / 2;
  }
  return Number(s);
}

function compare(op: Criterion["operator"], actual: number, c: Criterion): boolean {
  switch (op) {
    case "<=":
      return actual <= c.value;
    case "<":
      return actual < c.value;
    case ">=":
      return actual >= c.value;
    case ">":
      return actual > c.value;
    case "range":
      return actual >= c.value && (c.valueMax == null || actual <= c.valueMax);
  }
}

export type EvalInput = {
  kind: "physical" | "chemical";
  resultState: string;
  result?: Record<string, unknown>;
  resultSchema?: SchemaField[];
  reportingLimit?: number;
  unit?: string;
  methodId?: string;
  criterion?: Criterion | null;
};

/**
 * PASS/FAIL only with a compatible criterion (matching unit + method and a
 * comparable value). Everything else is REVIEW REQUIRED — never a guess.
 */
export function testEvaluator(input: EvalInput): { status: ResultStatus; message: string } {
  const { kind, resultState } = input;
  if (resultState === "Not Tested") return { status: "NOT TESTED", message: "Not tested." };
  if (resultState === "Not Applicable") return { status: "NOT APPLICABLE", message: "Not applicable." };

  const c = input.criterion ?? null;

  // ND: stored with reporting limit, never zero
  if (resultState === "ND") {
    if (kind !== "chemical") {
      return { status: "REVIEW REQUIRED", message: "ND applies to chemical results only." };
    }
    if (!c) return { status: "REVIEW REQUIRED", message: NOT_CONFIGURED };
    const rl = input.reportingLimit;
    if (rl == null || !(rl > 0)) {
      return { status: "REVIEW REQUIRED", message: "ND needs a reporting limit above 0." };
    }
    if (c.operator === "<=" || c.operator === "<") {
      const ok = c.operator === "<=" ? rl <= c.value : rl < c.value;
      return ok
        ? { status: "PASS", message: `Not detected below ${rl} ${input.unit ?? ""} (limit ${c.operator} ${c.value}).` }
        : { status: "REVIEW REQUIRED", message: `Reporting limit ${rl} is above the criterion — cannot confirm compliance.` };
    }
    return { status: "REVIEW REQUIRED", message: "ND cannot be judged against this criterion type." };
  }

  if (resultState === "Unknown" || !input.result) {
    return { status: "REVIEW REQUIRED", message: "Result unknown — recorded for review." };
  }

  if (!c) return { status: "REVIEW REQUIRED", message: NOT_CONFIGURED };

  // unit compatibility
  const cu = (c.unit ?? "").trim().toLowerCase();
  const ru = (input.unit ?? "").trim().toLowerCase();
  if (cu && ru && cu !== ru) {
    return { status: "REVIEW REQUIRED", message: `Unit mismatch (result ${input.unit}, criterion ${c.unit}).` };
  }
  // method compatibility
  if (c.methodId && input.methodId && c.methodId !== input.methodId) {
    return { status: "REVIEW REQUIRED", message: `Method mismatch (result ${input.methodId}, criterion ${c.methodId}).` };
  }

  // extract comparable numbers from the result
  const values: number[] = [];
  for (const f of input.resultSchema ?? []) {
    const raw = input.result[f.key];
    if (raw == null || raw === "") continue;
    if (f.type === "grade") values.push(parseGrade(raw, f.scale));
    else if (f.type === "number") {
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        throw Object.assign(new Error(`Invalid number for ${f.label}.`), { status: 422 });
      }
      values.push(n);
    }
  }
  if (values.length === 0 && kind === "chemical") {
    // Chemical results carry a plain { value } with no catalog resultSchema —
    // without this fallback every chemical verdict would be REVIEW REQUIRED.
    const raw = input.result["value"];
    const n = Number(raw);
    if (raw == null || raw === "" || !Number.isFinite(n)) {
      return { status: "REVIEW REQUIRED", message: "Chemical result needs a numeric value." };
    }
    values.push(n);
  }
  if (values.length === 0) {
    return { status: "REVIEW REQUIRED", message: "No comparable result value for this criterion." };
  }
  const pass = values.every((v) => compare(c.operator, v, c));
  return pass
    ? { status: "PASS", message: `Meets criterion ${c.operator} ${c.value}${c.unit ? ` ${c.unit}` : ""}.` }
    : { status: "FAIL", message: `Does not meet criterion ${c.operator} ${c.value}${c.unit ? ` ${c.unit}` : ""}.` };
}
