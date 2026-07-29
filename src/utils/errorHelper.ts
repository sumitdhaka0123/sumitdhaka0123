/**
 * Helper utility to format user-facing error messages.
 * Handles different error types and can optionally hide detailed system/database exceptions
 * from non-admin accounts to protect internal architecture details.
 */
export function formatUserMessage(error: any, isAdmin: boolean): string {
  if (!error) return '';

  // Get string description of error
  let message = '';
  if (typeof error === 'string') {
    message = error;
  } else if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'object') {
    message = error.error || error.message || JSON.stringify(error);
  } else {
    message = String(error);
  }

  // If user is admin, they should see details
  if (isAdmin) {
    return message;
  }

  // Security filtering for non-admin users
  // Hide live production server details (e.g., sumitdhaka0123.onrender.com, Firebase exceptions, network fetch failures)
  if (
    message.includes('onrender.com') ||
    message.includes('Failed to fetch') ||
    message.includes('firebase') ||
    message.includes('database') ||
    message.includes('Firestore') ||
    message.includes('NetworkError') ||
    message.includes('fetch')
  ) {
    return 'A synchronization or database exception occurred. Please verify your local warehouse manager connection settings or contact your administrator.';
  }

  return message;
}
