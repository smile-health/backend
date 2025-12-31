# Database Models Used in Order Controller

| Table Name      | Model Name     | Description                                                                                                                                                    |
| --------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| orders          | Order          | Represents orders with fields like device_type, customer_id, vendor_id, status, type, dates, and user-related fields.                                          |
| order_items     | OrderItem      | Represents items within an order with fields like order_id, material_id, qty, recommended_stock, confirmed_qty, reason_id, and user fields.                    |
| order_comments  | OrderComment   | Represents comments on orders with fields like user_id, order_id, comment, order_status, and user-related fields.                                              |
| entities        | Entity         | Represents entities such as customers or vendors with fields like name, address, code, location info, type, status, and user fields.                           |
| material_entity | MaterialEntity | Represents the relationship between materials and entities with fields like material_id, entity_id, pricing, stock levels, consumption rates, and user fields. |
| stocks          | Stock          | Represents stock batches with fields like year, price, total_price, material_entity_id, batch_id, qty, allocated, and user fields.                             |
| batches         | Batch          | Represents batch information with fields like code, expired_date, production_date, manufacture_id, status.                                                     |
| manufactures    | Manufacture    | Represents manufacturers with fields like name, reference_id, description, contact info, status, and user fields.                                              |
| transactions    | Transaction    | Represents stock transactions with fields like material_id, customer_id, vendor_id, stock_id, quantities, transaction types, user fields, and others.          |
| order_stocks    | OrderStock     | Represents stock allocations for order items with fields like order_item_id, stock_id, status, allocated_qty, received_qty, ordered_qty, and user fields.      |
| order_tags      | OrderTag       | Represents tags for orders with field title.                                                                                                                   |

This table summarizes the main database tables and their corresponding Sequelize models used in the orderController.js.
