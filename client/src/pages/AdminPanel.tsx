import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ShieldCheck,
  Users,
  Package,
  Stamp,
  Wallet,
  Search,
  Plus,
  Minus,
  Crown,
  User,
  ChevronRight,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

type UserRow = {
  id: number;
  name: string | null;
  email: string | null;
  role: "user" | "admin";
  credits: string;
  createdAt: Date;
  lastSignedIn: Date;
};

type AdjustModalState = {
  open: boolean;
  userId: number;
  userName: string;
  currentBalance: string;
};

type UserDetailState = {
  open: boolean;
  userId: number | null;
};

export default function AdminPanel() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const isAdmin = (user as any)?.role === "admin";

  const [search, setSearch] = useState("");
  const [adjustModal, setAdjustModal] = useState<AdjustModalState>({
    open: false, userId: 0, userName: "", currentBalance: "0",
  });
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustDirection, setAdjustDirection] = useState<"add" | "deduct">("add");
  const [adjustReason, setAdjustReason] = useState("");
  const [userDetail, setUserDetail] = useState<UserDetailState>({ open: false, userId: null });

  // Redirect non-admins
  if (isAuthenticated && !isAdmin) {
    setLocation("/");
    return null;
  }

  const { data: stats, refetch: refetchStats } = trpc.admin.getStats.useQuery(undefined, {
    enabled: isAdmin,
  });

  const { data: users, refetch: refetchUsers } = trpc.admin.listUsers.useQuery(
    { limit: 100, search: search || undefined },
    { enabled: isAdmin }
  );

  const { data: selectedUser } = trpc.admin.getUser.useQuery(
    { userId: userDetail.userId! },
    { enabled: userDetail.open && userDetail.userId !== null }
  );

  const updateRoleMutation = trpc.admin.updateRole.useMutation({
    onSuccess: () => {
      toast.success("Role updated successfully");
      refetchUsers();
    },
    onError: (err) => toast.error(err.message),
  });

  const adjustCreditsMutation = trpc.admin.adjustCredits.useMutation({
    onSuccess: (data) => {
      toast.success(`Credits adjusted. New balance: ${Number(data.newBalance).toFixed(4)}`);
      setAdjustModal({ open: false, userId: 0, userName: "", currentBalance: "0" });
      setAdjustAmount("");
      setAdjustReason("");
      refetchUsers();
      refetchStats();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleAdjustSubmit = () => {
    const amount = parseFloat(adjustAmount);
    if (!amount || amount <= 0) { toast.error("Enter a valid positive amount"); return; }
    if (!adjustReason.trim()) { toast.error("Reason is required"); return; }
    adjustCreditsMutation.mutate({
      userId: adjustModal.userId,
      amount,
      direction: adjustDirection,
      reason: adjustReason,
    });
  };

  const statCards = [
    { label: "Total Users", value: stats?.totalUsers ?? "—", icon: Users, color: "text-blue-600" },
    { label: "Total Shipments", value: stats?.totalShipments ?? "—", icon: Package, color: "text-green-600" },
    { label: "Certificates Issued", value: stats?.totalCertificates ?? "—", icon: Stamp, color: "text-purple-600" },
    { label: "Credits in Circulation", value: stats ? Number(stats.totalCreditsIssued).toFixed(2) : "—", icon: Wallet, color: "text-amber-600" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Admin Panel</h1>
              <p className="text-sm text-muted-foreground">Manage users, credits, and platform health</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => { refetchUsers(); refetchStats(); }}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="text-2xl font-bold mt-1">{value}</p>
                </div>
                <Icon className={`w-6 h-6 ${color}`} />
              </div>
            </Card>
          ))}
        </div>

        {/* Users Table */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users className="w-5 h-5" /> Users
              {users && <Badge variant="secondary">{users.length}</Badge>}
            </h2>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email…"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!users ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Loading users…
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u: UserRow) => (
                    <TableRow key={u.id} className="hover:bg-gray-50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold">
                            {(u.name || u.email || "?")[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{u.name || "—"}</p>
                            <p className="text-xs text-muted-foreground">{u.email || "—"}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={u.role === "admin" ? "default" : "secondary"}
                          className={u.role === "admin" ? "bg-red-100 text-red-700 border-red-200" : ""}
                        >
                          {u.role === "admin" ? <Crown className="w-3 h-3 mr-1" /> : <User className="w-3 h-3 mr-1" />}
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {Number(u.credits).toFixed(4)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(u.lastSignedIn).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {/* View detail */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setUserDetail({ open: true, userId: u.id })}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                          {/* Adjust credits */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setAdjustModal({ open: true, userId: u.id, userName: u.name || u.email || `User #${u.id}`, currentBalance: u.credits });
                              setAdjustDirection("add");
                              setAdjustAmount("");
                              setAdjustReason("");
                            }}
                          >
                            <TrendingUp className="w-4 h-4 text-amber-600" />
                          </Button>
                          {/* Toggle role */}
                          {u.id !== (user as any)?.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm(`Change ${u.name || u.email} role to ${u.role === "admin" ? "user" : "admin"}?`)) {
                                  updateRoleMutation.mutate({ userId: u.id, role: u.role === "admin" ? "user" : "admin" });
                                }
                              }}
                            >
                              {u.role === "admin"
                                ? <User className="w-4 h-4 text-gray-500" />
                                : <Crown className="w-4 h-4 text-red-500" />}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Adjust Credits Modal */}
      <Dialog open={adjustModal.open} onOpenChange={(o) => setAdjustModal(prev => ({ ...prev, open: o }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust Credits — {adjustModal.userName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <Wallet className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Current balance:</span>
              <span className="font-mono font-bold">{Number(adjustModal.currentBalance).toFixed(4)}</span>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Direction</label>
              <Select value={adjustDirection} onValueChange={(v) => setAdjustDirection(v as "add" | "deduct")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">
                    <span className="flex items-center gap-2 text-green-700"><Plus className="w-4 h-4" /> Add Credits</span>
                  </SelectItem>
                  <SelectItem value="deduct">
                    <span className="flex items-center gap-2 text-red-700"><Minus className="w-4 h-4" /> Deduct Credits</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Amount</label>
              <Input
                type="number"
                min="0.0001"
                step="0.01"
                placeholder="e.g. 100"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Reason <span className="text-red-500">*</span></label>
              <Input
                placeholder="e.g. Promotional credit, refund, correction…"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
              />
            </div>

            {adjustAmount && (
              <div className={`p-3 rounded-lg text-sm font-medium ${adjustDirection === "add" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                New balance will be:{" "}
                <span className="font-mono">
                  {(Number(adjustModal.currentBalance) + (adjustDirection === "add" ? 1 : -1) * parseFloat(adjustAmount || "0")).toFixed(4)}
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustModal(prev => ({ ...prev, open: false }))}>
              Cancel
            </Button>
            <Button
              onClick={handleAdjustSubmit}
              disabled={adjustCreditsMutation.isPending}
              className={adjustDirection === "deduct" ? "bg-red-600 hover:bg-red-700" : ""}
            >
              {adjustCreditsMutation.isPending ? "Processing…" : `${adjustDirection === "add" ? "Add" : "Deduct"} Credits`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Detail Drawer */}
      <Dialog open={userDetail.open} onOpenChange={(o) => setUserDetail(prev => ({ ...prev, open: o }))}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User Detail</DialogTitle>
          </DialogHeader>
          {!selectedUser ? (
            <div className="py-8 text-center text-muted-foreground">Loading…</div>
          ) : (
            <div className="space-y-6 py-2">
              {/* Profile */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center text-xl font-bold">
                  {(selectedUser.name || selectedUser.email || "?")[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-lg font-bold">{selectedUser.name || "—"}</p>
                  <p className="text-sm text-muted-foreground">{selectedUser.email || "—"}</p>
                  <Badge
                    variant={selectedUser.role === "admin" ? "default" : "secondary"}
                    className={`mt-1 ${selectedUser.role === "admin" ? "bg-red-100 text-red-700" : ""}`}
                  >
                    {selectedUser.role}
                  </Badge>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg text-center">
                  <p className="text-2xl font-bold">{Number(selectedUser.credits).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Credits</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg text-center">
                  <p className="text-2xl font-bold">{selectedUser.shipmentCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">Shipments</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg text-center">
                  <p className="text-2xl font-bold">{selectedUser.certificateCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">Certificates</p>
                </div>
              </div>

              {/* Recent Transactions */}
              {selectedUser.recentTransactions && selectedUser.recentTransactions.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3">Recent Transactions</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedUser.recentTransactions.map((tx: any) => (
                      <div key={tx.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                        <div>
                          <span className="font-medium">{tx.description || tx.type}</span>
                          {tx.featureUsed && <span className="text-xs text-muted-foreground ml-2">({tx.featureUsed})</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`font-mono font-bold ${Number(tx.amount) >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {Number(tx.amount) >= 0 ? "+" : ""}{Number(tx.amount).toFixed(4)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(tx.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setUserDetail({ open: false, userId: null });
                    setAdjustModal({
                      open: true,
                      userId: selectedUser.id,
                      userName: selectedUser.name || selectedUser.email || `User #${selectedUser.id}`,
                      currentBalance: selectedUser.credits,
                    });
                    setAdjustDirection("add");
                    setAdjustAmount("");
                    setAdjustReason("");
                  }}
                >
                  <TrendingUp className="w-4 h-4 mr-2" /> Adjust Credits
                </Button>
                {selectedUser.id !== (user as any)?.id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newRole = selectedUser.role === "admin" ? "user" : "admin";
                      if (confirm(`Change role to ${newRole}?`)) {
                        updateRoleMutation.mutate({ userId: selectedUser.id, role: newRole });
                        setUserDetail({ open: false, userId: null });
                      }
                    }}
                  >
                    {selectedUser.role === "admin"
                      ? <><User className="w-4 h-4 mr-2" /> Demote to User</>
                      : <><Crown className="w-4 h-4 mr-2" /> Promote to Admin</>}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
