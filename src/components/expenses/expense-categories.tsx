"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { expenseApi } from "@/api/expense.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiErrorMessage } from "@/lib/errors";
import type { ExpenseCategory } from "@/types";

/** Managers and owners add their own categories and switch unused ones off (they stay on old expenses). */
export function ExpenseCategories({ pharmacyId }: { pharmacyId: string }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const key = ["expenses", pharmacyId, "categories", "all"];
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => expenseApi.categories(pharmacyId, true) });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["expenses", pharmacyId, "categories"] });
  };

  const add = useMutation({
    mutationFn: () => expenseApi.createCategory(pharmacyId, name.trim()),
    onSuccess: () => {
      toast.success("Category added");
      setName("");
      refresh();
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Could not add the category")),
  });

  const toggle = useMutation({
    mutationFn: (c: ExpenseCategory) => expenseApi.updateCategory(pharmacyId, c.id, { active: !c.active }),
    onSuccess: refresh,
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Could not change the category")),
  });

  return (
    <div className="space-y-4 max-w-xl">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim().length >= 2) add.mutate();
        }}
      >
        <Input placeholder="New category, e.g. Security guard" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" disabled={name.trim().length < 2 || add.isPending}>
          {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" />Add</>}
        </Button>
      </form>

      <Card>
        <CardContent className="p-0 divide-y">
          {isLoading && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
          {data?.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className={c.active ? "" : "text-muted-foreground line-through"}>{c.name}</span>
                {!c.active && <Badge variant="outline">Switched off</Badge>}
              </div>
              <Button size="sm" variant="ghost" disabled={toggle.isPending} onClick={() => toggle.mutate(c)}>
                {c.active ? "Switch off" : "Switch on"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
