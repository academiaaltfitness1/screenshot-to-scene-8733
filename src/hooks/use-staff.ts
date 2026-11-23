import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ModuleKey } from "@/lib/modules";

export interface StaffInfo {
  userId: string;
  email: string;
  name: string;
  cargo: string;
  isAdmin: boolean;
  isStaff: boolean;
  permissions: string[];
}

export const staffQuery = queryOptions({
  queryKey: ["staff-me"],
  queryFn: async (): Promise<StaffInfo | null> => {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return null;
    const [profile, roles, perms] = await Promise.all([
      supabase.from("profiles").select("full_name, cargo, active").eq("id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.from("employee_permissions").select("module").eq("user_id", user.id),
    ]);
    const roleList = (roles.data ?? []).map((r) => r.role);
    return {
      userId: user.id,
      email: user.email ?? "",
      name: profile.data?.full_name || user.email || "Usuário",
      cargo: profile.data?.cargo ?? "",
      isAdmin: roleList.includes("admin"),
      isStaff: roleList.length > 0 && profile.data?.active !== false,
      permissions: (perms.data ?? []).map((p) => p.module),
    };
  },
  staleTime: 60_000,
});

export function useStaff() {
  const q = useQuery(staffQuery);
  const staff = q.data ?? null;
  const can = (key: ModuleKey) => !!staff && (staff.isAdmin || (staff.isStaff && staff.permissions.includes(key)));
  return { staff, can, isLoading: q.isLoading };
}

export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: async () => {
    const { data, error } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
    if (error) throw error;
    return data;
  },
});
