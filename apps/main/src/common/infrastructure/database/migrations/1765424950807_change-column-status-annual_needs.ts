import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`
	 ALTER TABLE ws_annual_needs
	 MODIFY COLUMN status smallint default 3,
	 MODIFY COLUMN min_max_status smallint
   `.execute(db)

  await sql`
  	ALTER TABLE ws_annual_need_ipvs
	MODIFY COLUMN status smallint`
	.execute(db)

  await sql`
  	ALTER TABLE ws_annual_need_populations
	MODIFY COLUMN status smallint`
	.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`
	 ALTER TABLE ws_annual_needs
	 MODIFY COLUMN status varchar(50) default 'DRAFT',
	 MODIFY COLUMN min_max_status varchar(50)
   `.execute(db)

  await sql`
  	ALTER TABLE ws_annual_need_ipvs
	MODIFY COLUMN status varchar(50)`
	.execute(db)

  await sql`
  	ALTER TABLE ws_annual_need_populations
	MODIFY COLUMN status varchar(50)`
	.execute(db)
}
