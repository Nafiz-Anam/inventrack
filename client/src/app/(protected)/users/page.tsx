"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Search, Users, MoreHorizontal, Shield, ShieldOff, Trash2, UserCheck, UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { SortableHeader } from "@/components/ui/sortable-header";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { format } from "date-fns";

interface UserItem {
  id: string;
  email: string;
  name: string | null;
  role: "USER" | "ADMIN" | "MODERATOR";
  isActive: boolean;
  isLocked: boolean;
  isEmailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface UserPagination {
  page: number;
  limit: number;
  totalPages: number;
  totalResults: number;
}

export default function UsersPage() {
  const currentUser = useAuthStore((s) => s.user);
  const confirm = useConfirm();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [pagination, setPagination] = useState<UserPagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sortBy, setSortBy] = useState("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit, sortBy, sortOrder: order };
      if (search) params.search = search;
      if (filterRole !== "all") params.role = filterRole;
      const { data } = await api.get("/users", { params });
      setUsers(data.results || []);
      setPagination({
        page: data.page || page,
        limit: data.limit || limit,
        totalPages: data.totalPages || 1,
        totalResults: data.totalResults || 0,
      });
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, filterRole, sortBy, order]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSort = (field: string, dir: "asc" | "desc") => {
    setSortBy(field);
    setOrder(dir);
    setPage(1);
  };

  const handleRoleChange = async (userId: string, newRole: "USER" | "ADMIN") => {
    try {
      await api.patch(`/users/${userId}`, { role: newRole });
      toast.success(`Role updated to ${newRole}`);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || "Failed to update role");
    }
  };

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    try {
      await api.patch(`/users/${userId}`, { isActive: !isActive });
      toast.success(isActive ? "User deactivated" : "User activated");
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || "Failed to update user");
    }
  };

  const handleDelete = async (userId: string) => {
    const ok = await confirm({ title: "Delete User", description: "Permanently delete this user? This cannot be undone.", confirmText: "Delete", variant: "danger" });
    if (!ok) return;
    try {
      await api.delete(`/users/${userId}`);
      toast.success("User deleted");
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || "Failed to delete user");
    }
  };

  const roleLabels: Record<string, string> = {
    all: "All Roles", USER: "User", ADMIN: "Admin",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">User Management</h1>
        <p className="text-slate-500 text-[15px] mt-0.5">Manage registered users and their roles</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search by name or email..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 w-72 h-10 bg-white border-slate-200" />
        </div>
        <Select value={filterRole} onValueChange={(v) => { if (v) { setFilterRole(v); setPage(1); } }}>
          <SelectTrigger className="w-36 h-10 bg-white border-slate-200">
            <span>{roleLabels[filterRole] || filterRole}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="USER">User</SelectItem>
            <SelectItem value="ADMIN">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead><SortableHeader label="Name" field="name" currentSort={sortBy} currentOrder={order} onSort={handleSort} /></TableHead>
                <TableHead><SortableHeader label="Email" field="email" currentSort={sortBy} currentOrder={order} onSort={handleSort} /></TableHead>
                <TableHead className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Role</TableHead>
                <TableHead className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Status</TableHead>
                <TableHead><SortableHeader label="Last Login" field="lastLoginAt" currentSort={sortBy} currentOrder={order} onSort={handleSort} /></TableHead>
                <TableHead><SortableHeader label="Joined" field="createdAt" currentSort={sortBy} currentOrder={order} onSort={handleSort} /></TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12">
                  <div className="h-6 w-6 border-2 border-orange-200 border-t-orange-600 rounded-lg animate-spin mx-auto" />
                </TableCell></TableRow>
              ) : users.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12">
                  <Users className="h-10 w-10 text-slate-200 mx-auto mb-2" />
                  <p className="text-slate-400 text-[14px]">No users found</p>
                </TableCell></TableRow>
              ) : (
                users.map((u) => {
                  const isSelf = currentUser?.id === u.id;
                  return (
                    <TableRow key={u.id} className="hover:bg-slate-50/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-[13px] font-semibold text-slate-500">
                            {u.name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <span className="font-semibold text-[14px] text-slate-700">{u.name || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-[13.5px] text-slate-500">{u.email}</TableCell>
                      <TableCell>
                        <Badge className={`border-0 text-[11px] font-semibold rounded-[4px] ${
                          u.role === "ADMIN"
                            ? "bg-amber-50 text-amber-700 hover:bg-amber-50"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-100"
                        }`}>
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-sm ${u.isActive ? "bg-emerald-500" : "bg-slate-300"}`} />
                          <span className="text-[13px] text-slate-500">{u.isActive ? "Active" : "Inactive"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-[13px] text-slate-400">
                        {u.lastLoginAt ? format(new Date(u.lastLoginAt), "MMM d, h:mm a") : "Never"}
                      </TableCell>
                      <TableCell className="text-[13px] text-slate-400">
                        {format(new Date(u.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={<Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" />}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {/* Toggle role */}
                            {!isSelf && (
                              <DropdownMenuItem
                                onClick={() => handleRoleChange(u.id, u.role === "ADMIN" ? "USER" : "ADMIN")}
                                className="gap-2 text-[13px]"
                              >
                                {u.role === "ADMIN" ? (
                                  <><ShieldOff className="h-3.5 w-3.5 text-slate-400" />Demote to User</>
                                ) : (
                                  <><Shield className="h-3.5 w-3.5 text-slate-400" />Promote to Admin</>
                                )}
                              </DropdownMenuItem>
                            )}

                            {/* Toggle active */}
                            {!isSelf && (
                              <DropdownMenuItem
                                onClick={() => handleToggleActive(u.id, u.isActive)}
                                className="gap-2 text-[13px]"
                              >
                                {u.isActive ? (
                                  <><UserX className="h-3.5 w-3.5 text-slate-400" />Deactivate</>
                                ) : (
                                  <><UserCheck className="h-3.5 w-3.5 text-slate-400" />Activate</>
                                )}
                              </DropdownMenuItem>
                            )}

                            {/* Delete */}
                            {!isSelf && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleDelete(u.id)}
                                  className="gap-2 text-[13px] text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete User
                                </DropdownMenuItem>
                              </>
                            )}

                            {isSelf && (
                              <DropdownMenuItem disabled className="gap-2 text-[13px] text-slate-400">
                                This is your account
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {pagination && (
        <DataTablePagination page={page} totalPages={pagination.totalPages} totalResults={pagination.totalResults}
          limit={limit} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} />
      )}
    </div>
  );
}
