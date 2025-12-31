# Database Models Used in Transaction Controller

| Table Name             | Model Name           | Description                                                                                                                                                    |
| ---------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| stocks                 | Stock                | Represents stock batches with fields like year, price, total_price, material_entity_id, batch_id, qty, allocated, and user fields.                             |
| batches                | Batch                | Represents batch information with fields like code, expired_date, production_date, manufacture_id, status.                                                     |
| transactions           | Transaction          | Represents stock transactions with fields like material_id, customer_id, vendor_id, stock_id, quantities, transaction types, user fields, and others.          |
| transaction_injections | TransactionInjection | Represents injection details related to transactions with fields like transaction_id, dose_1, dose_2, dose_booster, dose_routine.                              |
| material_entity        | MaterialEntity       | Represents the relationship between materials and entities with fields like material_id, entity_id, pricing, stock levels, consumption rates, and user fields. |
| transaction_types      | TransactionType      | Represents types of transactions with fields like title, chg_type, and virtual fields indicating restock, add, or remove capabilities.                         |
| users                  | User                 | Represents users with fields like id, username, firstname, lastname, etc. (used for created_by, updated_by associations)                                       |
| entities               | Entity               | Represents entities such as customers or vendors with fields like name, address, code, location info, type, status, and user fields.                           |

This table summarizes the main database tables and their corresponding Sequelize models used in the transactionController.js.
