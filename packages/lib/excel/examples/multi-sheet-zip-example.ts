// import { Client } from "minio";
import { MultiSheetZipExporter } from "../multi-sheet-zip";

/**
 * Example demonstrating MultiSheetZipExporter usage
 * This example shows how to create multi-sheet Excel files with streaming data
 */
async function example() {
  const exporter = new MultiSheetZipExporter({
    language: "en",
    timezone: "UTC",
    batchSize: 1000,
    bucketName: "exports",
  });

  const inventoryGroup = {
    id: "inventory",
    name: "Inventory Report",
    sheets: {
      stockSummary: { sheetName: "Stock Summary" },
      stockDetails: { sheetName: "Stock Details" },
    },
    columns: {
      stockSummary: [
        { header: "Product ID", width: 15 },
        { header: "Product Name", width: 30 },
        { header: "Total Stock", width: 15 },
        { header: "Value", width: 15 },
      ],
      stockDetails: [
        { header: "Product ID", width: 15 },
        { header: "Location", width: 20 },
        { header: "Quantity", width: 15 },
        { header: "Last Updated", width: 20 },
      ],
    },
  };

  const transactionsGroup = {
    id: "transactions",
    name: "Transaction Report",
    sheets: {
      incoming: { sheetName: "Incoming" },
      outgoing: { sheetName: "Outgoing" },
    },
    columns: {
      incoming: [
        { header: "Transaction Date", width: 20 },
        { header: "Reference", width: 20 },
        { header: "Material Code", width: 15 },
        { header: "Material Name", width: 40 },
        { header: "Quantity", width: 15 },
        { header: "Source", width: 30 },
      ],
      outgoing: [
        { header: "Transaction Date", width: 20 },
        { header: "Reference", width: 20 },
        { header: "Material Code", width: 15 },
        { header: "Material Name", width: 40 },
        { header: "Quantity", width: 15 },
        { header: "Destination", width: 30 },
      ],
    },
  };

  // Initialize file groups
  exporter.initFileGroup(inventoryGroup.id, inventoryGroup.name);
  exporter.initFileGroup(transactionsGroup.id, transactionsGroup.name);

  // Initialize and configure inventory sheets
  await exporter.initSheet(
    inventoryGroup.id,
    inventoryGroup.sheets.stockSummary.sheetName
  );
  await exporter.initSheet(
    inventoryGroup.id,
    inventoryGroup.sheets.stockDetails.sheetName
  );
  exporter.setColumns(
    inventoryGroup.id,
    inventoryGroup.sheets.stockSummary.sheetName,
    inventoryGroup.columns.stockSummary
  );
  exporter.setColumns(
    inventoryGroup.id,
    inventoryGroup.sheets.stockDetails.sheetName,
    inventoryGroup.columns.stockDetails
  );

  // Initialize and configure transaction sheets
  await exporter.initSheet(
    transactionsGroup.id,
    transactionsGroup.sheets.incoming.sheetName
  );
  await exporter.initSheet(
    transactionsGroup.id,
    transactionsGroup.sheets.outgoing.sheetName
  );
  exporter.setColumns(
    transactionsGroup.id,
    transactionsGroup.sheets.incoming.sheetName,
    transactionsGroup.columns.incoming
  );
  exporter.setColumns(
    transactionsGroup.id,
    transactionsGroup.sheets.outgoing.sheetName,
    transactionsGroup.columns.outgoing
  );

  // Sample data generation functions
  async function* generateInventorySummary() {
    const products = [
      { id: "PROD001", name: "Laptop Computer", stock: 150, value: 75000 },
      { id: "PROD002", name: "Wireless Mouse", stock: 500, value: 12500 },
      { id: "PROD003", name: "USB Keyboard", stock: 300, value: 15000 },
    ];

    for (const product of products) {
      yield {
        "Product ID": product.id,
        "Product Name": product.name,
        "Total Stock": product.stock,
        Value: product.value,
      };
    }
  }

  async function* generateInventoryDetails() {
    const details = [
      {
        id: "PROD001",
        location: "Warehouse A",
        quantity: 75,
        updated: "2024-01-15",
      },
      {
        id: "PROD001",
        location: "Warehouse B",
        quantity: 75,
        updated: "2024-01-15",
      },
      {
        id: "PROD002",
        location: "Warehouse A",
        quantity: 250,
        updated: "2024-01-14",
      },
      {
        id: "PROD002",
        location: "Warehouse B",
        quantity: 250,
        updated: "2024-01-14",
      },
    ];

    for (const detail of details) {
      yield {
        "Product ID": detail.id,
        Location: detail.location,
        Quantity: detail.quantity,
        "Last Updated": detail.updated,
      };
    }
  }

  // Add data using async generators for streaming
  await exporter.addRows(
    inventoryGroup.id,
    inventoryGroup.sheets.stockSummary.sheetName,
    generateInventorySummary()
  );
  await exporter.addRows(
    inventoryGroup.id,
    inventoryGroup.sheets.stockDetails.sheetName,
    generateInventoryDetails()
  );

  // Add data to the incoming transactions sheet
  const incomingData = [
    {
      "Transaction Date": "2023-01-15",
      Reference: "PO001",
      "Material Code": "MAT001",
      "Material Name": "Paracetamol 500mg",
      Quantity: 1000,
      Source: "Supplier A",
    },
    {
      "Transaction Date": "2023-02-10",
      Reference: "PO002",
      "Material Code": "MAT002",
      "Material Name": "Amoxicillin 250mg",
      Quantity: 500,
      Source: "Supplier B",
    },
  ];
  await exporter.addRows(
    transactionsGroup.id,
    transactionsGroup.sheets.incoming.sheetName,
    incomingData
  );

  // Add data to the outgoing transactions sheet
  const outgoingData = [
    {
      "Transaction Date": "2023-03-05",
      Reference: "SO001",
      "Material Code": "MAT001",
      "Material Name": "Paracetamol 500mg",
      Quantity: 200,
      Destination: "Clinic A",
    },
    {
      "Transaction Date": "2023-03-10",
      Reference: "SO002",
      "Material Code": "MAT002",
      "Material Name": "Amoxicillin 250mg",
      Quantity: 50,
      Destination: "Clinic B",
    },
  ];
  await exporter.addRows(
    transactionsGroup.id,
    transactionsGroup.sheets.outgoing.sheetName,
    outgoingData
  );

  // Example of using with Minio (commented out as it requires actual Minio setup)
  // const minioClient = new Client({
  //   endPoint: "play.min.io",
  //   port: 9000,
  //   useSSL: true,
  //   accessKey: "minioadmin",
  //   secretKey: "minioadmin",
  // });

  // const fileUrl = await exporter.exportToMinio(
  //   minioClient,
  //   "https://play.min.io",
  //   "multi-sheet-export.zip"
  // );
  // console.log(`File exported to: ${fileUrl}`);

  // For local testing without Minio, you can use the finalize method
  // and write the zip to a file manually
  const zip = await exporter.finalize();
  console.log("Zip file created with the following files:");
  Object.keys(zip.files).forEach((fileName) => {
    console.log(` - ${fileName}`);
  });

  return zip;
}

// Run the example
if (require.main === module) {
  example().catch(console.error);
}

export { example };
