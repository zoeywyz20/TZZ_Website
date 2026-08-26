import 'server-only';

type ApiErrorBody = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

export function apiSuccess<T>(data: T, status = 200): Response {
  return Response.json(
    {
      success: true,
      data,
    },
    { status },
  );
}

export function apiError(
  code: string,
  message: string,
  status: number,
): Response {
  const body: ApiErrorBody = {
    success: false,
    error: {
      code,
      message,
    },
  };

  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
