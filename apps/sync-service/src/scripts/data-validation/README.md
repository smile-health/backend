# Data Migration Scripts Documentation

This directory contains documentation and validation scripts for the data migration process defined in the Jenkins pipeline `run-db-migration.groovy`.

## Migration Scripts Overview

The following scripts are executed during the "0 Pre Migration Script" stage:

### 1. `update-material-children`
- **Source**: `src/scripts/pre-data-migration/material/update-material-children.ts`
- **Purpose**: Updates existing material records in `master_materials` table.
- **Actions**:
  - Updates `name`, `kfa_code`, and `description` for materials defined in `materialChildren` constant.
  - Updates or inserts records into `master_material_has_activities` to link materials with activities.
  - Skips updates if no changes are needed.

### 2. `seed-material-parents`
- **Source**: `src/scripts/pre-data-migration/material/seed-material-parents.ts`
- **Purpose**: Creates parent material records (Level 2) and organizes the material hierarchy.
- **Actions**:
  - Optionally truncates existing parent materials (kfa_level_id = 2).
  - Creates new parent materials based on `materialParents` constant.
  - Uses the first child material as a template for the parent's properties.
  - Links child materials to their new parents by updating `parent_id` and setting `kfa_level_id` to 3.
  - Aggregates activity associations from children to the parent.

### 3. `update-master-activities-code`
- **Source**: `src/scripts/pre-data-migration/activity/update-master-activities-code.ts`
- **Purpose**: Standardizes activity codes in `master_activities` table.
- **Actions**:
  - Updates the `code` column for activities based on a predefined mapping (e.g., 1 -> "rutin", 6 -> "covid").
  - Sets `code` to `NULL` for any activities not present in the mapping.

### 4. `remove-duplicate-msi`
- **Source**: `src/scripts/pre-data-migration/entity/remove-duplicate-msi.ts`
- **Purpose**: Cleans up duplicate `id_satu_sehat` mappings in `mapping_entities`.
- **Actions**:
  - Identifies `id_satu_sehat` values associated with multiple entities.
  - Verifies against the external DIN/Satu Sehat API to find the correct location (Regency/KabKota).
  - Removes mappings where the entity's regency does not match the API's response.
  - Handles specific hardcoded cases for removal.

### 5. `compare-data-entity-imun-vs-logistic`
- **Source**: `src/scripts/data-migration/workspace/migrate-entity/entity-compare.ts`
- **Purpose**: Validates and synchronizes entity data between the migration source (Imun) and the destination (V5/Logistic).
- **Actions**:
  - Compares entities based on `id_satu_sehat` and name.
  - Identifies missing entities in both databases.
  - Inserts missing entities from Imun to V5.
  - Synchronizes `id_satu_sehat` mappings.
  - Generates a detailed JSON report of the comparison.

## Validation

A validation script is provided to verify the integrity of the data after these migrations have run.

### Running Validation
Run the validation script using:
```bash
npx bun ./src/scripts/data-validation/validate-migration.ts
```
