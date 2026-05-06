# Security Specification - Lumina AI

## Data Invariants
1. A **User** profile can only be created by the owner and must have standard roles.
2. **Credits** can only be decreased by users (spending), unless it's the initial trial grant upon verification.
3. **BatchItems** belong to the user and can only be managed by them.
4. **BrandProfiles** belong to the user and can only be managed by them. Document IDs must be valid.
5. **Payments** can only be read by the owner and never written by the client.

## The "Dirty Dozen" Payloads (BrandProfile Edition)
1. **Identity Spoofing**: Attempting to create a brand in another user's path.
2. **ID Poisoning**: Using a 2MB string as a brand document ID.
3. **Shadow Update**: Adding `isAdmin: true` to a BrandProfile.
4. **State Shortcutting**: Modifying `id` or `userId` (if present) after creation.
5. **PII Blanket Test**: Authenticated user trying to list another user's brands.
6. **Resource Exhaustion**: Sending a 10MB base64 string in `logos`.
7. **Type Mismatch**: Sending a number for `typography`.
8. **Malicious ID**: Using `../` or special characters in the brand ID path variable.
9. **Role Escalation**: User trying to update their own `role` to `admin`.
10. **Credit Hack**: User trying to increase their own `credits` field directly via update.
11. **Verification Bypass**: User marking themselves as `isVerified: true` without an OTP check (already partially guarded).
12. **Orphaned Writes**: Creating a brand without a valid parent user document (if required).

## Test Cases
- [ ] `GET /users/hacker/brands/mybrand` as `victim` -> **DENIED**
- [ ] `POST /users/victim/brands/malicious` as `hacker` -> **DENIED**
- [ ] `PATCH /users/victim` set `role: 'admin'` as `victim` -> **DENIED**
- [ ] `PATCH /users/victim` set `credits: 9999` as `victim` -> **DENIED**
- [ ] `POST /users/victim/brands/valid` with `logo.data.size() > 10MB` -> **DENIED**
