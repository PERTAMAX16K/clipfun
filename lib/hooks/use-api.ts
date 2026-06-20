import useSWR, { SWRConfiguration } from "swr";
import { usePrivySession } from "@/app/providers";
import { useCallback } from "react";

class ApiError extends Error {
  status: number;
  info: any;
  constructor(message: string, status: number, info: any) {
    super(message);
    this.status = status;
    this.info = info;
  }
}

export function useApi<Data = any, Error = any>(
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
      throw new ApiError("An error occurred while fetching the data.", res.status, info);
    }

    return res.json() as Promise<Data>;
  }, [getAccessToken]);

  return useSWR<Data, Error>(key, fetcher, config);
}

export function useApiMutation<Data = any>() {
  const { getAccessToken } = usePrivySession();

  const mutate = useCallback(async (
    url: string, 
    options: { method?: "POST" | "PUT" | "PATCH" | "DELETE", body?: any }
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
      throw new ApiError("An error occurred while modifying the data.", res.status, info);
    }

    return res.json() as Promise<Data>;
  }, [getAccessToken]);

  return { mutate };
}
