/*
    Standard API responses

    Instead of repeating:

    Response.json()

    everywhere,
    we centralize it.
*/

export function successResponse(data: any, message = "Success") {
  return Response.json({
    success: true,
    message,
    data,
  });
}

export function errorResponse(message: string, status: number = 400) {
  return Response.json(
    {
      success: false,
      message,
    },
    { status },
  );
}
