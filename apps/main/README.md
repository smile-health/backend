# MAIN Service
New service handling workspace module, including iotx
Currently we copy all the code from platform service, but need to migrate and merge old table and modify
the repository layer to use the new db

Use centralized db, but with prefix ws_ in its tablename
Also use dedicated kysely migration table as well, so please use only available scripts below

## Available scripts
- `npm run db:make` - Create new migration.
- `npm run db:migrate` Run the migration (if using npx)
- `npm run db:rollback` - Rollback latest migration
- `npm run view:make` - Create new view (or seeder) script
- `npm run view:migrate` - Run the view (or seeder) script
- `npm run build` - Generate db codegen
- `npm run cron` - Run cron server
