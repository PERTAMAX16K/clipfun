import useSWR, { SWRConfiguration } from "swr";
import { usePrivySession } from "@/app/providers";
import { useCallback } from "react";

export class ApiError extends Error {
  status: number;
  info: unknown;
  constructor(message: string, status: number, info: unknown) {
    super(message);
    this.status = status;
    this.info = info;
  }
}

export function getErrorMessage(error: unknown, fallback = "Something went wrong") {
  return error instanceof Error ? error.message : fallback;
}

type JsonBody = unknown;

export function useApi<Data = unknown, Error = ApiError>(
  key: string | null,
  config?: SWRConfiguration<Data, Error>
) {
  const { getAccessToken } = usePrivySession();

  const fetcher = useCallback(async (url: string) => {
    const token = await getAccessToken();
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(url, { headers });
    
    if (!res.ok) {
      const info = await res.json().catch(() => ({}));
      const errorMsg = info?.error || info?.message || "An error occurred while fetching the data.";
      throw new ApiError(errorMsg, res.status, info);
    }

    return res.json() as Promise<Data>;
  }, [getAccessToken]);

  return useSWR<Data, Error>(key, fetcher, config);
}

export function useApiMutation<Data = unknown>() {
  const { getAccessToken } = usePrivySession();

  const mutate = useCallback(async (
    url: string, 
    options: { method?: "POST" | "PUT" | "PATCH" | "DELETE", body?: JsonBody }
  ) => {
    const token = await getAccessToken();
    const headers: HeadersInit = {};
    
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    
    if (options.body) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(url, {
      method: options.method || "POST",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!res.ok) {
      const info = await res.json().catch(() => ({}));
      const errorMsg = info?.error || info?.message || "An error occurred while modifying the data.";
      throw new ApiError(errorMsg, res.status, info);
    }

    return res.json() as Promise<Data>;
  }, [getAccessToken]);

  return { mutate };
}
