import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase admin client
 */
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * UAE week boundaries
 * Monday 00:00 → next Monday 00:00 (UAE)
 */
function getUAEWeekBounds() {
  const nowUTC = new Date();
  const nowUAE = new Date(nowUTC.getTime() + 4 * 60 * 60 * 1000);

  const day = nowUAE.getUTCDay();
  const diffToMonday = (day === 0 ? -6 : 1) - day;

  const weekStartUAE = new Date(nowUAE);
  weekStartUAE.setUTCDate(nowUAE.getUTCDate() + diffToMonday);
  weekStartUAE.setUTCHours(0, 0, 0, 0);

  const weekEndUAE = new Date(weekStartUAE);
  weekEndUAE.setUTCDate(weekStartUAE.getUTCDate() + 7);

  return {
    week_start: new Date(weekStartUAE.getTime() - 4 * 60 * 60 * 1000),
    week_end: new Date(weekEndUAE.getTime() - 4 * 60 * 60 * 1000),
  };
}

export const handler: Handler = async (event: any) => {
  const isManual =
    event.httpMethod === "POST" &&
    event.headers["x-manual-run"] === "true";

  if (!event?.cron && !isManual) {
    return { statusCode: 403, body: "Forbidden" };
  }

  console.log("🚀 Weekly Leaderboard Job Started");

  const { week_start, week_end } = getUAEWeekBounds();

  /**
   * Guard: already processed
   */
  const { count } = await supabase
    .from("weekly_leaderboard")
    .select("id", { count: "exact", head: true })
    .eq("week_start", week_start.toISOString());

  if (count && count > 0) {
    console.log("⚠️ Week already processed");
    return { statusCode: 200, body: "Already processed" };
  }

  /**
   * Reset previous latest
   */
  await supabase
    .from("weekly_leaderboard")
    .update({ is_latest: false })
    .eq("is_latest", true);

  /**
   * Compute via SQL function
   */
  const { data, error } = await supabase.rpc(
    "generate_weekly_leaderboard",
    {
      p_week_start: week_start.toISOString(),
      p_week_end: week_end.toISOString(),
    }
  );

  if (error) {
    console.error(error);
    return { statusCode: 500, body: "Computation failed" };
  }

  /**
   * Insert results
   */
  const rows = data.map((r: any) => ({
    ...r,
    week_start,
    week_end,
    is_latest: true,
  }));

  const { error: insertError } = await supabase
    .from("weekly_leaderboard")
    .insert(rows);

  if (insertError) {
    console.error(insertError);
    return { statusCode: 500, body: "Insert failed" };
  }

  console.log(`✅ Inserted ${rows.length} leaderboard rows`);

  return {
    statusCode: 200,
    body: "Weekly leaderboard generated successfully",
  };
};