export class ExcelError extends Error {
  statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class SheetNotFound extends ExcelError {
  constructor(message: string = "excel.not_sheet") {
    super(message, 404)
  }
}

export class WorkbookNotFound extends ExcelError {
  constructor(message: string = "excel.not_workbook") {
    super(message, 404)
  }
}

export class WorkbookEmpty extends ExcelError {
  constructor(message: string = "excel.empty_workbook") {
    super(message, 400)
  }
}
