export default function errorResponse(message: string) {
  return {
    message,
    errors: [],
  }
}
