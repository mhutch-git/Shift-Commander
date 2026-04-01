import { useState } from "react";
import {
  useListUsers, getListUsersQueryKey,
  useListShifts,
  useCreateUser, useUpdateUser, useDeleteUser,
  type CreateUserBodyRole,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Pencil } from "lucide-react";

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    admin: "bg-red-100 text-red-800 border-red-200",
    sergeant: "bg-blue-100 text-blue-700 border-blue-200",
    deputy: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${colors[role] ?? colors.deputy}`}>
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  );
}

type UserForm = {
  email: string; password: string; firstName: string;
  lastName: string; role: string; shiftId: string; isActive: boolean;
};

const emptyForm: UserForm = {
  email: "", password: "", firstName: "", lastName: "",
  role: "deputy", shiftId: "", isActive: true,
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<any | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);

  const { data: users, isLoading } = useListUsers();
  const { data: shifts } = useListShifts();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const openAdd = () => { setForm(emptyForm); setAddOpen(true); };
  const openEdit = (u: any) => {
    setEditUser(u);
    setForm({
      email: u.email, password: "", firstName: u.firstName,
      lastName: u.lastName, role: u.role, shiftId: String(u.shiftId ?? ""),
      isActive: u.isActive,
    });
  };

  const handleAdd = async () => {
    if (!form.email || !form.password || !form.firstName || !form.lastName) {
      toast({ title: "All fields required", variant: "destructive" }); return;
    }
    try {
      await createUser.mutateAsync({ data: {
        email: form.email, password: form.password, firstName: form.firstName,
        lastName: form.lastName, role: form.role as CreateUserBodyRole,
        shiftId: form.shiftId ? parseInt(form.shiftId) : undefined,
      }});
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      setAddOpen(false);
      toast({ title: "Personnel account created" });
    } catch (err: any) {
      toast({ title: "Failed to create user", description: err?.message, variant: "destructive" });
    }
  };

  const handleEdit = async () => {
    if (!editUser) return;
    try {
      const updates: Record<string, unknown> = {
        firstName: form.firstName, lastName: form.lastName,
        role: form.role, isActive: form.isActive,
        shiftId: form.shiftId ? parseInt(form.shiftId) : null,
      };
      if (form.password) updates.password = form.password;
      await updateUser.mutateAsync({ id: editUser.id, data: updates });
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      setEditUser(null);
      toast({ title: "User updated" });
    } catch {
      toast({ title: "Failed to update user", variant: "destructive" });
    }
  };

  const handleToggleActive = async (u: any) => {
    try {
      await updateUser.mutateAsync({ id: u.id, data: { isActive: !u.isActive } });
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      toast({ title: u.isActive ? "User deactivated" : "User activated" });
    } catch {
      toast({ title: "Failed to update status", variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Personnel Management</h1>
          <Button onClick={openAdd} data-testid="btn-add-user">
            <UserPlus className="w-4 h-4 mr-2" />
            Add Personnel
          </Button>
        </div>

        <Card className="border-card-border">
          <CardContent className="pt-4">
            {isLoading ? (
              <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border">
                      <th className="pb-2 pr-4">Name</th>
                      <th className="pb-2 pr-4">Email</th>
                      <th className="pb-2 pr-4">Role</th>
                      <th className="pb-2 pr-4">Shift</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {users?.length === 0 ? (
                      <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No personnel found</td></tr>
                    ) : (
                      users?.map((u: any) => (
                        <tr key={u.id} className="hover:bg-muted/30 transition-colors" data-testid={`user-row-${u.id}`}>
                          <td className="py-2.5 pr-4 font-medium text-foreground">{u.firstName} {u.lastName}</td>
                          <td className="py-2.5 pr-4 text-muted-foreground text-xs">{u.email}</td>
                          <td className="py-2.5 pr-4"><RoleBadge role={u.role} /></td>
                          <td className="py-2.5 pr-4 text-muted-foreground">{u.shiftName ?? "Unassigned"}</td>
                          <td className="py-2.5 pr-4">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${u.isActive ? "bg-green-100 text-green-800 border-green-200" : "bg-muted text-muted-foreground border-border"}`}>
                              {u.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="py-2.5">
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEdit(u)}
                                data-testid={`btn-edit-user-${u.id}`}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleToggleActive(u)}
                                data-testid={`btn-toggle-active-${u.id}`}
                              >
                                {u.isActive ? "Deactivate" : "Activate"}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add User Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Personnel</DialogTitle></DialogHeader>
          <UserFormFields form={form} setForm={setForm} shifts={shifts ?? []} isAdd />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={createUser.isPending} data-testid="btn-confirm-add-user">
              {createUser.isPending ? "Creating..." : "Create Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Personnel</DialogTitle></DialogHeader>
          <UserFormFields form={form} setForm={setForm} shifts={shifts ?? []} />
          <div className="py-2 flex items-center gap-3">
            <input
              type="checkbox"
              id="is-active"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              data-testid="checkbox-is-active"
            />
            <Label htmlFor="is-active">Active</Label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={updateUser.isPending} data-testid="btn-confirm-edit-user">
              {updateUser.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function UserFormFields({ form, setForm, shifts, isAdd }: {
  form: UserForm; setForm: (f: UserForm) => void; shifts: any[]; isAdd?: boolean;
}) {
  const f = (k: keyof UserForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <div className="space-y-3 py-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>First Name</Label>
          <Input value={form.firstName} onChange={f("firstName")} data-testid="input-first-name" />
        </div>
        <div className="space-y-1.5">
          <Label>Last Name</Label>
          <Input value={form.lastName} onChange={f("lastName")} data-testid="input-last-name" />
        </div>
      </div>
      {isAdd && (
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" value={form.email} onChange={f("email")} data-testid="input-user-email" />
        </div>
      )}
      <div className="space-y-1.5">
        <Label>{isAdd ? "Password" : "New Password (leave blank to keep)"}</Label>
        <Input type="password" value={form.password} onChange={f("password")} data-testid="input-user-password" />
      </div>
      <div className="space-y-1.5">
        <Label>Role</Label>
        <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
          <SelectTrigger data-testid="select-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="deputy">Deputy</SelectItem>
            <SelectItem value="sergeant">Sergeant</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Shift Assignment</Label>
        <Select value={form.shiftId || "none"} onValueChange={(v) => setForm({ ...form, shiftId: v === "none" ? "" : v })}>
          <SelectTrigger data-testid="select-shift">
            <SelectValue placeholder="Unassigned" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Unassigned</SelectItem>
            {shifts.map((s: any) => (
              <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
