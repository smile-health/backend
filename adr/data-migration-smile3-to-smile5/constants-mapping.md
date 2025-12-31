# Migration Constants Mapping

This document explains the migration constants defined in  
`apps/sync-service/src/scripts/data-migration/const.ts`. These mappings are used by multiple migration scripts to translate IDs and other references from the SMILE 3.0 database to the SMILE 5.0 platform.

---

## MAP_EXISTING_TO_PLATFORM

**Definition**

```typescript
export const MAP_EXISTING_TO_PLATFORM =
  await getMapExistingToPlatformProgramId();
```

- **Source**:  
  Populated by the helper function `getMapExistingToPlatformProgramId()` which reads the `mapping_programs` (or equivalent) table from the SMILE 5.0 database.
- **Purpose**:  
  Provides a lookup from an “existing” (SMILE 3.0) program ID to its corresponding target (SMILE 5.0) program ID.
- **Usage**:  
  Many scripts pass an `--programId` option to specify the source program; this constant lets them find the new platform program ID for inserts and further mapping.

---

## MAP_EXISTING_ACTIVITY_IDS

**Definition**

```typescript
export const MAP_EXISTING_ACTIVITY_IDS =
  await getMapExistingActivityIdsByProgramId();
```

- **Source**:  
  Populated by the helper function `getMapExistingActivityIdsByProgramId()` which reads the `mapping_activities` table in SMILE 5.0.
- **Purpose**:  
  For a given source program, returns a map of source activity IDs to their corresponding target activity IDs in SMILE 5.0.
- **Usage**:  
  Workspace-scoped scripts that migrate entity-activity or material-activity relations use this map to link to the newly created `ws_activities` records.

---

## MAP_USER_EMAIL

**Definition**

```typescript
export const MAP_USER_EMAIL = {
  1: { _rab: 6 },
  2: { _mal: 3, _tb: 4, _hiv: 5 },
};
```

- **Hard-coded Map**:  
  A JSON object that maps:
  - Key: SMILE 3.0 program ID (e.g., `1`, `2`)
  - Value: Object mapping user email domain codes (e.g., `_rab`, `_mal`) to SMILE 5.0 platform user IDs.
- **Purpose**:  
  Provides a fallback or supplemental mapping for user records when email-domain logic is needed to assign the correct new user ID in SMILE 5.0.
- **Usage**:  
  The global `migrate-user-bulk.ts` script uses this map to assign existing SMILE 3.0 user accounts to the correct SMILE 5.0 user record.

---

**Note**:

- All migration scripts import these constants from `const.ts`.
- The first two constants are dynamically generated at runtime and should be valid before running any migration command.
- Ensure that the `mapping_programs` and `mapping_activities` tables in the SMILE 5.0 database are populated (or empty but created) before running migrations that depend on them.
