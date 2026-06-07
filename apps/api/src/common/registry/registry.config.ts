// UI Element Regular Expressions
export const DATA_TESTID_REGEX = /data-testid\s*=\s*["']([^"']+)["']/gi;
export const ID_REGEX = /\bid\s*=\s*["']([^"']+)["']/gi;
export const NAME_REGEX = /\bname\s*=\s*["']([^"']+)["']/gi;
export const TYPE_REGEX = /\btype\s*=\s*["']([^"']+)["']/gi;

// Regex to capture UI tag and its attributes block
export const UI_TAG_REGEX = /<(button|input|form|select|textarea)\b([^>]*)/gi;

// API Endpoint Regular Expressions
export const NESTJS_ROUTE_REGEX = /@(Get|Post|Put|Delete|Patch)\s*\(\s*['"]([^'"]*)['"]\s*\)/gi;
export const EXPRESS_ROUTE_REGEX = /\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]*)['"]\s*,/gi;
export const AXIOS_ROUTE_REGEX = /axios\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]*)['"]/gi;
export const FETCH_ROUTE_REGEX = /fetch\s*\(\s*['"]([^'"]*)['"]/gi;

// Route Parameter Regular Expressions
export const EXPRESS_PARAM_REGEX = /:([a-zA-Z0-9_]+)/g;
export const NEXTJS_PARAM_REGEX = /\[([a-zA-Z0-9_]+)\]/g;
