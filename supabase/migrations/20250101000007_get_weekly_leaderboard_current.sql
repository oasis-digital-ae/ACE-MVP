-- Isolated to avoid Supabase CLI parser "syntax error at or near as" when splitting SQL functions
CREATE OR REPLACE FUNCTION "public"."get_weekly_leaderboard_current"() RETURNS TABLE("user_id" "uuid", "full_name" "text", "rank" bigint, "weekly_return" numeric)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $_$
  SELECT 
    wl.user_id,
    COALESCE(
      CASE WHEN p.full_name IS NOT NULL AND trim(p.full_name) <> '' 
           AND p.full_name !~ '^User [0-9a-fA-F]{8}$'
           THEN trim(p.full_name) END,
      NULLIF(trim(concat_ws(' ', p.first_name, p.last_name)), ''),
      p.username,
      'Unknown User'
    ) AS full_name,
    wl.rank::BIGINT,
    wl.weekly_return
  FROM weekly_leaderboard wl
  JOIN profiles p ON p.id = wl.user_id
  WHERE wl.is_latest = true
  ORDER BY wl.rank ASC;
$_$;


ALTER FUNCTION "public"."get_weekly_leaderboard_current"() OWNER TO "postgres";


GRANT ALL ON FUNCTION "public"."get_weekly_leaderboard_current"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_weekly_leaderboard_current"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_weekly_leaderboard_current"() TO "service_role";
