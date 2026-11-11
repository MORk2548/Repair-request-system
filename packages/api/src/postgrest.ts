// a double-quoted PostgREST filter value, so , . ( ) and : inside it stay part of the value
export const quote = (value: string) => `"${value.replace(/["\\]/g, '\\$&')}"`;
