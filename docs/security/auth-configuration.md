# Auth Configuration

## Leaked Password Protection

**Status:** Enabled
**Date Enabled:** 2026-05-11
**Details:** Supabase Auth checks all new passwords against HaveIBeenPwned.org to prevent compromised password usage.

### How to Verify in Dashboard
1. Navigate to: https://app.supabase.com/project/[YOUR_PROJECT_ID]/auth/policies
2. Look for "Password strength and leaked password protection" section
3. Verify "Check Leaked Passwords" toggle is enabled

### Impact
- All new user signups will have passwords checked
- Existing password changes will be checked
- Compromised passwords are rejected with user-friendly error message
