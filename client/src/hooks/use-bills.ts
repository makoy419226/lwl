import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { api } from "@shared/routes";
import type { Bill, CreateBillRequest } from "@shared/schema";

export function useBills() {
  return useQuery<Bill[]>({
    queryKey: [api.bills.list.path],
  });
}

export function useBill(id: number) {
  const url = api.bills.get.path.replace(":id", String(id));
  return useQuery<Bill>({
    queryKey: [url],
  });
}

export function useCreateBill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateBillRequest) => {
      const response = await apiRequest("POST", api.bills.create.path, data);
      return response.json() as Promise<Bill>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.bills.list.path] });
    },
  });
}

export function useDeleteBill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = api.bills.delete.path.replace(":id", String(id));
      await apiRequest("DELETE", url);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.bills.list.path] });
    },
  });
}
