export interface AppError {
  code: string;
  message: string;
  technicalDetails?: string;
  type: 'server' | 'database' | 'validation' | 'unknown';
}

export function parseError(error: any, fallbackContext = "Unknown system error"): AppError {
  let message = fallbackContext;
  let code = "ERR_UNKNOWN";
  let type: 'server' | 'database' | 'validation' | 'unknown' = 'unknown';
  let technicalDetails = "";

  if (typeof error === 'string') {
    technicalDetails = error;
    message = error;
  } else if (error instanceof Error) {
    technicalDetails = error.stack || error.message;
    message = error.message;
  } else if (error && typeof error === 'object') {
    technicalDetails = JSON.stringify(error);
    if (error.message) message = error.message;
  }

  const detailLower = technicalDetails.toLowerCase();

  // Classify error type
  if (
    detailLower.includes('failed to fetch') || 
    detailLower.includes('networkerror') || 
    detailLower.includes('502') || 
    detailLower.includes('504') ||
    detailLower.includes('econnrefused') ||
    detailLower.includes('network error')
  ) {
    code = "ERR_SRV_UNAVAILABLE";
    type = "server";
    message = "The backend server is offline, down, or unreachable.";
  } else if (
    detailLower.includes('permission-denied') || 
    detailLower.includes('unauthorized') || 
    detailLower.includes('403') || 
    detailLower.includes('401')
  ) {
    code = "ERR_DB_UNAUTHORIZED";
    type = "database";
    message = "Database access denied. Insufficient credentials or security rule violation.";
  } else if (detailLower.includes('chassis') && (detailLower.includes('unique') || detailLower.includes('duplicate'))) {
    code = "ERR_CHASSIS_DUPLICATE";
    type = "validation";
    message = "Chassis number already exists in database. Verify system unique identifier.";
  } else if (detailLower.includes('firestore') || detailLower.includes('firebase') || detailLower.includes('firestoreState')) {
    code = "ERR_DB_WRITE_FAIL";
    type = "database";
    message = "Firestore storage write failed. Rules check rejected payload.";
  } else if (detailLower.includes('insufficient') || detailLower.includes('stock')) {
    code = "ERR_STOCK_INSUFFICIENT";
    type = "validation";
    message = "Insufficient unassigned warehouse stock logged.";
  } else if (
    detailLower.includes('select') || 
    detailLower.includes('fill') || 
    detailLower.includes('required') || 
    detailLower.includes('provide') || 
    detailLower.includes('choose') ||
    detailLower.includes('valid')
  ) {
    type = "validation";
    code = "ERR_VALIDATION_FAILED";
  }

  return { code, message, technicalDetails, type };
}

export function formatUserMessage(error: any, isAdmin: boolean, fallbackContext?: string): string {
  const parsed = parseError(error, fallbackContext);
  
  // Validation errors (missing fields, wrong format) should be seen directly by everyone so they can fix their input
  if (parsed.type === 'validation') {
    return parsed.message;
  }

  if (isAdmin) {
    // Admins see full technical detail to debug
    return `[${parsed.code}] ${parsed.message} | System Details: ${parsed.technicalDetails}`;
  } else {
    // Regular employees see ONLY the obfuscated error code for security
    return `System Error: ${parsed.code}. Please report this code to the Warehouse Administrator.`;
  }
}
