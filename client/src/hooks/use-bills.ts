import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { api } from "@shared/routes";
import type { Bill, CreateBillRequest } from "@shared/schema";

export function useBills() {
  return useQuery({
    queryKey: [api.bills.list.path],
    queryFn: async () => {
      const response = await apiRequest(api.bills.list.path, "GET");
      return response as Bill[];
    },
  });
}

export function useBill(id: number) {
  return useQuery({
    queryKey: [api.bills.get.path, id],
    queryFn: async () => {
      const response = await apiRequest(
        api.bills.get.path.replace(":id", String(id)),
        "GET"
      );
      return response as Bill;
    },
  });
}

export function useCreateBill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateBillRequest) => {
      const response = await apiRequest(api.bills.create.path, "POST", data);
      return response as Bill;
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
      await apiRequest(api.bills.delete.path.replace(":id", String(id)), "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.bills.list.path] });
    },
  });
}
