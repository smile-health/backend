import { db } from "@/common/infrastructure/database/index.js"
import { AsikModule } from "@/modules/asik/asik.module.js"
import { AsikRepository } from "@/modules/asik/asik.repository.js"

export const syncAsikAggregateCron = async (
  input_date?: string,
  page?: number,
  iterate = true
) => {
  const repo = new AsikRepository()
  const module = new AsikModule(repo)

  try {
    const result = await db.transaction().execute(async (trx) => {
      return await module.syncAggregate(trx, {
        input_date,
        page,
        iterate,
        max_pages: 5000,
      })
    })

    console.log(result)
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}
