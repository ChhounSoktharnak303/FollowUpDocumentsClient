export class ExcelLockedError extends Error {
  readonly code = "EXCEL_LOCKED";

  constructor() {
    super("Close the Excel file and try again.");
    this.name = "ExcelLockedError";
  }
}

export class StoreNotFoundError extends Error {
  readonly code = "NOT_FOUND";

  constructor(message = "Record not found") {
    super(message);
    this.name = "StoreNotFoundError";
  }
}

export class StoreConflictError extends Error {
  readonly code = "CONFLICT";

  constructor(message = "This record already exists") {
    super(message);
    this.name = "StoreConflictError";
  }
}

export class StoreValidationError extends Error {
  readonly code = "VALIDATION";

  constructor(message = "Invalid data") {
    super(message);
    this.name = "StoreValidationError";
  }
}
