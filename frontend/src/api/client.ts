const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

type QueryScalar = string | number | boolean | null | undefined;
type QueryValue = QueryScalar | Array<string | number>;

export type QueryParams = Record<string, QueryValue>;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function buildQuery(params: QueryParams = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      // 数组值序列化为重复查询参数（months=8&months=9），匹配 FastAPI list 解析。
      value.forEach((item) => search.append(key, String(item)));
    } else if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function requestJson<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    },
    ...options
  });

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new ApiError(detail, response.status);
  }

  return (await response.json()) as T;
}

async function readErrorDetail(response: Response) {
  try {
    const payload = (await response.json()) as { detail?: unknown };
    return typeof payload.detail === "string"
      ? payload.detail
      : `请求失败：${response.status}`;
  } catch {
    return `请求失败：${response.status}`;
  }
}
