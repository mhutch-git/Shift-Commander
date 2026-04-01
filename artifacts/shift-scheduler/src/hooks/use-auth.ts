import { useGetMe, getGetMeQueryKey, useLogin as useApiLogin, useLogout as useApiLogout, LoginBody } from "@workspace/api-client-react";
import type { UseQueryOptions } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

export function useAuth() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: user, isLoading, error } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      retry: false,
    } as UseQueryOptions<any, any, any, any>
  });

  const loginMutation = useApiLogin();
  const logoutMutation = useApiLogout();

  const login = async (data: LoginBody) => {
    try {
      await loginMutation.mutateAsync({ data });
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setLocation("/");
    } catch (err) {
      throw err;
    }
  };

  const logout = async () => {
    try {
      await logoutMutation.mutateAsync();
      queryClient.clear();
      setLocation("/login");
    } catch (err) {
      throw err;
    }
  };

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    error,
  };
}
