import type { UserContext } from "./types.js";
import type { SqlResult } from "./providers.js";

// Safe demo query tool: allowlisted intent + fixed SQL shape + parameterised values.
// Do NOT turn this into unrestricted execution of arbitrary LLM-generated SQL.
export async function queryRefundMetrics(
  question: string,
  user: UserContext,
): Promise<SqlResult | undefined> {
  if (
    !/refund|orders|order count|refund rate|refund value|transaction value/i.test(
      question,
    )
  )
    return undefined;
  if (!user.roles.includes("analytics_reader"))
    throw new Error("User is not authorised to query analytics data.");
  const match = question.match(/(20\d{2})[-/](0[1-9]|1[0-2])/);
  const month = match ? `${match[1]}-${match[2]}` : "2026-09";
  // Demo data adapter. Production: execute this fixed, parameterised query using a read-only DB role.
  const rows: Record<string, Omit<SqlResult, "month">> = {
    "2026-09": {
      refundsCount: 42,
      ordersCount: 1200,
      refundValue: 7350.5,
      refundRate: 42 / 1200,
    },
    "2026-08": {
      refundsCount: 37,
      ordersCount: 1140,
      refundValue: 6120,
      refundRate: 37 / 1140,
    },
  };
  const row = rows[month];
  if (!row) return undefined;
  return { month, ...row };
}
