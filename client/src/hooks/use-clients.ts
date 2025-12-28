import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { api } from "@shared/routes";
import type { Client, CreateClientRequest, UpdateClientRequest } from "@shared/schema";

export function useClients(search?: string) {
  return useQuery({
    queryKey: [api.clients.list.path, search],
    queryFn: async () => {
      const response = await apiRequest(
        api.clients.list.path,
        "GET",
        undefined,
        search ? { search } : undefined
      );
      return response as Client[];
    },
  });
}

export function useClient(id: number) {
  return useQuery({
    queryKey: [api.clients.get.path, id],
    queryFn: async () => {
      const response = await apiRequest(
        api.clients.get.path.replace(":id", String(id)),
        "GET"
      );
      return response as Client;
    },
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateClientRequest) => {
      const response = await apiRequest(api.clients.create.path, "POST", data);
      return response as Client;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.clients.list.path] });
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateClientRequest }) => {
      const response = await apiRequest(
        api.clients.update.path.replace(":id", String(id)),
        "PUT",
        data
      );
      return response as Client;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.clients.list.path] });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(api.clients.delete.path.replace(":id", String(id)), "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.clients.list.path] });
    },
  });
}
