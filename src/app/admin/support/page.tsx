"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Loader2, LifeBuoy } from "lucide-react";
import { adminSupportApi } from "@/api/admin.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminSupportSessionsPage() {
  const [page, setPage] = useState(0);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "support-sessions", page], queryFn: () => adminSupportApi.list({ page, size: 20 }) });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight"><LifeBuoy className="h-7 w-7" /> Support sessions</h1>
        <p className="text-muted-foreground">Every time an admin opened a pharmacy&apos;s private data: who, why, how long and how many changes were made. Each change is also in the audit log.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
          <CardDescription>{data?.totalElements ?? 0} sessions</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 font-medium">Started</th>
                    <th className="pb-3 font-medium">Admin</th>
                    <th className="pb-3 font-medium">Pharmacy</th>
                    <th className="pb-3 font-medium">Reason</th>
                    <th className="pb-3 font-medium">Until</th>
                    <th className="pb-3 font-medium">Changes</th>
                    <th className="pb-3 font-medium">State</th>
                  </tr>
                </thead>
                <tbody className="divide-y align-top">
                  {(data?.content ?? []).map((s) => (
                    <tr key={s.id}>
                      <td className="py-2.5 pr-3 whitespace-nowrap text-muted-foreground">{new Date(s.startedAt).toLocaleString()}</td>
                      <td className="py-2.5 pr-3">{s.adminEmail}</td>
                      <td className="py-2.5 pr-3 whitespace-nowrap"><Link href={`/admin/pharmacies/${s.pharmacyId}`} className="font-medium hover:underline">{s.pharmacyName ?? s.pharmacyId}</Link></td>
                      <td className="py-2.5 pr-3 max-w-sm text-muted-foreground">{s.reason}</td>
                      <td className="py-2.5 pr-3 whitespace-nowrap text-muted-foreground">{new Date(s.endedAt ?? s.expiresAt).toLocaleTimeString()}</td>
                      <td className="py-2.5 pr-3 tabular-nums">{s.writeCount}</td>
                      <td className="py-2.5"><Badge variant={s.active ? "default" : "outline"}>{s.active ? "Open" : s.endedAt ? "Ended" : "Expired"}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(data?.content.length ?? 0) === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No support sessions yet.</p>}
            </div>
          )}
          {(data?.totalPages ?? 0) > 1 && (
            <div className="mt-4 flex items-center justify-between border-t pt-4">
              <p className="text-sm text-muted-foreground">Page {page + 1} of {data?.totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= (data?.totalPages ?? 1) - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
