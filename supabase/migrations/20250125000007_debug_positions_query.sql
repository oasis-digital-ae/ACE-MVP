-- Test query to debug the positions issue
-- Let's check if there are any data issues or constraints

-- Check if there are any positions for the user
SELECT COUNT(*) as position_count FROM positions WHERE user_id = '2f2c0a1b-fd11-4c67-ad36-722d4ad1f080';

-- Check if there are any teams
SELECT COUNT(*) as team_count FROM teams;

-- Check if the specific team exists
SELECT id, name FROM teams WHERE id = 121;

-- Test a simple positions query without the join
SELECT * FROM positions WHERE user_id = '2f2c0a1b-fd11-4c67-ad36-722d4ad1f080' LIMIT 5;
