import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function seed(db: Kysely<Database>): Promise<void> {
  const workspaces = [
    {
      id: 1,
      key: "immunization",
      name: "Immunization",
      config: {
        is_annual_planning: true,
        is_immunization: true,
        material: {
          is_hierarchy_enabled: true,
          is_batch_enabled: false,
        },
        color: "#004990",
      },
      deleted_at: "2025-05-08 10:33:53",
    },
    {
      id: 2,
      key: "logistic",
      name: "OBAT ESSENSIAL",
      config: {
        color: "#680771",
        material: {
          is_batch_enabled: false,
          is_hierarchy_enabled: true,
        },
        transaction: {
          is_transfer_stock_restricted: false,
        },
      },
      deleted_at: null,
    },
    {
      id: 3,
      key: "malaria",
      name: "MALARIA",
      config: {
        material: {
          is_hierarchy_enabled: true,
          is_batch_enabled: false,
        },
        transaction: {
          is_transfer_stock_restricted: false,
        },
        color: "#dc2626",
      },
      deleted_at: null,
    },
    {
      id: 4,
      key: "tb",
      name: "TB",
      config: {
        color: "#6b21a8",
        order: {
          is_create_restricted: false,
          is_confirm_restricted: true,
        },
        clients: ["sitb", "din"],
        icon_url:
          "https://smile-platform.badr.co.id/images/icon-programs/SMILE_TUBERKOLOSIS.png",
        material: {
          is_batch_enabled: false,
          is_hierarchy_enabled: true,
        },
        transaction: {
          is_transfer_stock_restricted: false,
        },
      },
      deleted_at: null,
    },
    {
      id: 5,
      key: "hiv",
      name: "HIV",
      config: {
        material: {
          is_hierarchy_enabled: true,
          is_batch_enabled: false,
        },
        order: {
          is_create_restricted: false,
          is_confirm_restricted: true,
        },
        transaction: {
          is_transfer_stock_restricted: false,
        },
        clients: ["sitb", "din"],
        color: "#681d17",
        icon_url:
          "https://smile-platform.badr.co.id/images/icon-programs/SMILE_HIV.png",
      },
      deleted_at: null,
    },
    {
      id: 6,
      key: "rabies",
      name: "Rabies",
      config: {
        is_immunization: true,
        material: {
          is_hierarchy_enabled: true,
          is_batch_enabled: false,
        },
        color: "#e9d5ff",
      },
      deleted_at: "2025-05-08 10:33:53",
    },
    {
      id: 7,
      key: "anti-venom",
      name: "Anti Venom",
      config: {
        material: {
          is_hierarchy_enabled: true,
          is_batch_enabled: false,
        },
        color: "#334155",
      },
      deleted_at: "2025-05-08 10:33:53",
    },
    {
      id: 8,
      key: "dengue",
      name: "Dengue",
      config: {
        is_immunization: true,
        material: {
          is_hierarchy_enabled: true,
          is_batch_enabled: false,
        },
        color: "#e7ffa3",
      },
      deleted_at: "2025-05-08 10:33:53",
    },
    {
      id: 9,
      key: "bmhp-skrining",
      name: "PKG",
      config: {
        color: "#eab308",
        material: {
          is_batch_enabled: false,
          is_hierarchy_enabled: true,
        },
        transaction: {
          is_transfer_stock_restricted: false,
        },
      },
      deleted_at: null,
    },
    {
      id: 11,
      key: "Radiologi",
      name: "Radiologi",
      config: {
        material: {
          is_hierarchy_enabled: false,
          is_batch_enabled: false,
        },
        color: "#a3a3a3",
      },
      deleted_at: "2025-05-08 10:33:53",
    },
    {
      id: 12,
      key: "hepatitis",
      name: "HEPATITIS",
      config: {
        material: {
          is_hierarchy_enabled: true,
          is_batch_enabled: false,
        },
        color: "#ea580c",
        transaction: {
          is_transfer_stock_restricted: false,
        },
      },
      deleted_at: null,
    },
    {
      id: 13,
      key: "keswa",
      name: "KESEHATAN JIWA",
      config: {
        material: {
          is_hierarchy_enabled: true,
          is_batch_enabled: false,
        },
        color: "#c026d3",
        transaction: {
          is_transfer_stock_restricted: false,
        },
      },
      deleted_at: null,
    },
    {
      id: 14,
      key: "frambusia",
      name: "FRAMBUSIA",
      config: {
        material: {
          is_hierarchy_enabled: true,
          is_batch_enabled: false,
        },
        color: "#a16207",
        transaction: {
          is_transfer_stock_restricted: false,
        },
      },
      deleted_at: null,
    },
    {
      id: 15,
      key: "filariasis",
      name: "FILARIASIS",
      config: {
        material: {
          is_hierarchy_enabled: true,
          is_batch_enabled: false,
        },
        color: "#b45309",
        transaction: {
          is_transfer_stock_restricted: false,
        },
      },
      deleted_at: null,
    },
    {
      id: 16,
      key: "diare",
      name: "DIARE",
      config: {
        material: {
          is_hierarchy_enabled: true,
          is_batch_enabled: false,
        },
        color: "#ca8a04",
        transaction: {
          is_transfer_stock_restricted: false,
        },
      },
      deleted_at: null,
    },
    {
      id: 17,
      key: "kusta",
      name: "KUSTA",
      config: {
        material: {
          is_hierarchy_enabled: true,
          is_batch_enabled: false,
        },
        color: "#eab308",
        transaction: {
          is_transfer_stock_restricted: false,
        },
      },
      deleted_at: null,
    },
    {
      id: 18,
      key: "kesga",
      name: "KESEHATAN KELUARGA",
      config: {
        material: {
          is_hierarchy_enabled: true,
          is_batch_enabled: false,
        },
        color: "#f87171",
        transaction: {
          is_transfer_stock_restricted: false,
        },
      },
      deleted_at: null,
    },
    {
      id: 19,
      key: "kesling",
      name: "KESEHATAN LINGKUNGAN",
      config: {
        color: "#84cc16",
        material: {
          is_batch_enabled: false,
          is_hierarchy_enabled: true,
        },
      },
      deleted_at: null,
    },
    {
      id: 20,
      key: "difteri",
      name: "Difteri",
      config: {
        is_immunization: true,
        material: {
          is_hierarchy_enabled: true,
          is_batch_enabled: false,
        },
        color: "#e7ffa3",
      },
      deleted_at: "2025-05-08 10:33:53",
    },
    {
      id: 999,
      key: "dummywms",
      name: "dummywms",
      config: {
        material: {
          is_hierarchy_enabled: true,
          is_batch_enabled: false,
        },
        color: "#06b6d4",
      },
      deleted_at: "2025-11-19 07:10:03",
    },
  ].map((workspace) => ({
    ...workspace,
    config: JSON.stringify(workspace.config),
    deleted_at: workspace.deleted_at ? new Date(workspace.deleted_at) : null,
  }))

  await db
    .insertInto("workspaces")
    .values(workspaces)
    .onDuplicateKeyUpdate({
      config: sql<string>`VALUES (config)`,
      updated_at: new Date(),
    })
    .execute()
}
