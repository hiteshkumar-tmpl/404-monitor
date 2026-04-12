import { useState } from "react";
import { Link } from "wouter";
import {
  useGetUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  UserRole,
} from "@workspace/api-client-react";
import { formatDistanceToNow, format } from "date-fns";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Users,
  Shield,
  User as UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function AdminUsers() {
  const { data: users, isLoading } = useGetUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{
    id: number;
    name: string;
    email: string;
    role: string;
  } | null>(null);

  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState<"admin" | "user">("user");

  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<"admin" | "user">("user");

  const handleCreate = async () => {
    try {
      await createUser.mutateAsync({
        data: {
          name: createName,
          email: createEmail,
          password: createPassword,
          role: createRole,
        },
      });
      toast({
        title: "User created",
        description: `${createName} has been created successfully.`,
      });
      setShowCreateDialog(false);
      setCreateName("");
      setCreateEmail("");
      setCreatePassword("");
      setCreateRole("user");
      queryClient.invalidateQueries({ queryKey: ["getUsers"] });
    } catch {
      toast({
        title: "Error",
        description: "Failed to create user.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = async () => {
    if (!selectedUser) return;
    try {
      await updateUser.mutateAsync({
        id: selectedUser.id,
        data: {
          name: editName,
          role: editRole,
        },
      });
      toast({
        title: "User updated",
        description: `${editName} has been updated successfully.`,
      });
      setShowEditDialog(false);
      setSelectedUser(null);
      queryClient.invalidateQueries({ queryKey: ["getUsers"] });
    } catch {
      toast({
        title: "Error",
        description: "Failed to update user.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    try {
      await deleteUser.mutateAsync({ id: selectedUser.id });
      toast({
        title: "User deleted",
        description: `${selectedUser.name} has been deleted successfully.`,
      });
      setShowDeleteDialog(false);
      setSelectedUser(null);
      queryClient.invalidateQueries({ queryKey: ["getUsers"] });
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete user.",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (user: {
    id: number;
    name: string;
    email: string;
    role: string;
  }) => {
    setSelectedUser(user);
    setEditName(user.name);
    setEditRole(user.role as "admin" | "user");
    setShowEditDialog(true);
  };

  const openDeleteDialog = (user: {
    id: number;
    name: string;
    email: string;
    role: string;
  }) => {
    setSelectedUser(user);
    setShowDeleteDialog(true);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center space-x-4">
        <Link href="/dashboard">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground">
            User Management
          </h1>
          <p className="text-muted-foreground">
            Manage user accounts and roles.
          </p>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          className="font-mono text-xs"
        >
          <Plus className="mr-2 h-4 w-4" />
          ADD USER
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-mono text-base flex items-center">
            <Users className="h-4 w-4 mr-2" />
            All Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : users && users.length > 0 ? (
            <div className="border border-border rounded-md overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 font-mono font-medium">Name</th>
                    <th className="px-4 py-3 font-mono font-medium">Email</th>
                    <th className="px-4 py-3 font-mono font-medium">Role</th>
                    <th className="px-4 py-3 font-mono font-medium">Created</th>
                    <th className="px-4 py-3 font-mono font-medium">
                      Last Login
                    </th>
                    <th className="px-4 py-3 font-mono font-medium text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <UserIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                          <span className="font-medium">{user.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {user.email}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            user.role === "admin" ? "default" : "secondary"
                          }
                          className="font-mono text-[10px]"
                        >
                          {user.role === "admin" ? (
                            <>
                              <Shield className="h-3 w-3 mr-1" />
                              ADMIN
                            </>
                          ) : (
                            <>
                              <UserIcon className="h-3 w-3 mr-1" />
                              USER
                            </>
                          )}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {format(new Date(user.createdAt), "PP")}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {user.lastLoginAt
                          ? formatDistanceToNow(new Date(user.lastLoginAt), {
                              addSuffix: true,
                            })
                          : "Never"}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => openEditDialog(user)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => openDeleteDialog(user)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 border border-dashed border-border rounded-md">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No users found.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-mono">CREATE USER</DialogTitle>
            <DialogDescription>
              Add a new user account. They will be able to log in with the
              provided credentials.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label
                htmlFor="create-name"
                className="font-mono text-xs text-muted-foreground"
              >
                NAME
              </Label>
              <Input
                id="create-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                className="font-mono"
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="create-email"
                className="font-mono text-xs text-muted-foreground"
              >
                EMAIL
              </Label>
              <Input
                id="create-email"
                type="email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                className="font-mono"
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="create-password"
                className="font-mono text-xs text-muted-foreground"
              >
                PASSWORD
              </Label>
              <Input
                id="create-password"
                type="password"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                className="font-mono"
                placeholder="Minimum 6 characters"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="create-role"
                className="font-mono text-xs text-muted-foreground"
              >
                ROLE
              </Label>
              <Select
                value={createRole}
                onValueChange={(v) => setCreateRole(v as "admin" | "user")}
              >
                <SelectTrigger className="font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">
                    <span className="flex items-center">
                      <UserIcon className="h-4 w-4 mr-2" />
                      User
                    </span>
                  </SelectItem>
                  <SelectItem value="admin">
                    <span className="flex items-center">
                      <Shield className="h-4 w-4 mr-2" />
                      Admin
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createUser.isPending}>
              {createUser.isPending ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-mono">EDIT USER</DialogTitle>
            <DialogDescription>
              Update user details for {selectedUser?.email}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label
                htmlFor="edit-name"
                className="font-mono text-xs text-muted-foreground"
              >
                NAME
              </Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="edit-role"
                className="font-mono text-xs text-muted-foreground"
              >
                ROLE
              </Label>
              <Select
                value={editRole}
                onValueChange={(v) => setEditRole(v as "admin" | "user")}
              >
                <SelectTrigger className="font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">
                    <span className="flex items-center">
                      <UserIcon className="h-4 w-4 mr-2" />
                      User
                    </span>
                  </SelectItem>
                  <SelectItem value="admin">
                    <span className="flex items-center">
                      <Shield className="h-4 w-4 mr-2" />
                      Admin
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={updateUser.isPending}>
              {updateUser.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-mono text-destructive">
              DELETE USER
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedUser?.name}? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteUser.isPending}
            >
              {deleteUser.isPending ? "Deleting..." : "Delete User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
