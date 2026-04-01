import { useListShifts } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Sun, Moon, Users, ChevronRight } from "lucide-react";
import { Link } from "wouter";

function ShiftCard({ shift }: { shift: any }) {
  const isDay = shift.shiftType === "day";
  const Icon = isDay ? Sun : Moon;
  const letterColor = shift.shiftLetter === "a" ? "bg-primary/10 text-primary border-primary/20" : "bg-amber-100 text-amber-800 border-amber-200";

  return (
    <Link href={`/shifts/${shift.id}`}>
      <Card
        className="border-card-border hover:shadow-md hover:border-primary/30 cursor-pointer transition-all"
        data-testid={`shift-card-${shift.id}`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-md ${isDay ? "bg-amber-100" : "bg-slate-800"}`}>
                <Icon className={`w-5 h-5 ${isDay ? "text-amber-700" : "text-slate-200"}`} />
              </div>
              <div>
                <CardTitle className="text-base font-bold">{shift.name}</CardTitle>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium border ${letterColor}`}>
                  Shift {shift.shiftLetter?.toUpperCase()}
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Shield className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Sergeant:</span>
            <span className="font-medium text-foreground">{shift.sergeantName ?? "Unassigned"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Personnel:</span>
            <Badge variant="secondary" className="font-semibold">{shift.members?.length ?? 0}</Badge>
          </div>
          <div className="mt-3 pt-3 border-t border-border/60">
            <div className="flex flex-wrap gap-1">
              {shift.members?.slice(0, 4).map((m: any) => (
                <span key={m.id} className="inline-block px-2 py-0.5 bg-muted rounded text-xs text-muted-foreground">
                  {m.firstName} {m.lastName.charAt(0)}.
                </span>
              ))}
              {(shift.members?.length ?? 0) > 4 && (
                <span className="inline-block px-2 py-0.5 bg-muted rounded text-xs text-muted-foreground">
                  +{shift.members.length - 4} more
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function ShiftsPage() {
  const { data: shifts, isLoading } = useListShifts();

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Shifts</h1>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array(4).fill(0).map((_, i) => (
              <Card key={i}><CardContent className="pt-6"><Skeleton className="h-40 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {shifts?.map((shift: any) => (
              <ShiftCard key={shift.id} shift={shift} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
