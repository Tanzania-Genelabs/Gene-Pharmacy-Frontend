"use client";

import { use, useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { posApi } from "@/api/pos.api";
import { customerApi } from "@/api/customer.api";
import { branchApi } from "@/api/branch.api";
import { catalogApi } from "@/api/catalog.api";
import { useAuthStore } from "@/store/auth.store";
import { toast } from "sonner";
import {
  ScanBarcode,
  Search,
  Plus,
  Minus,
  Trash2,
  RefreshCw,
  ShoppingCart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BarcodeLookupResponse } from "@/types";

interface CartItem {
  drugId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  stockAvailable: number;
}

interface PageProps {
  params: Promise<{ pharmacyId: string }>;
}

export default function PosPage({ params }: PageProps) {
  const { pharmacyId } = use(params);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const [branchId, setBranchId] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerPhone, setCustomerPhone] = useState("");

  const { data: branches } = useQuery({
    queryKey: ["branches", pharmacyId],
    queryFn: () => branchApi.list(pharmacyId),
  });

  // Auto-select first branch
  useEffect(() => {
    if (branches && branches.length > 0 && !branchId) {
      setBranchId(branches[0].id);
    }
  }, [branches, branchId]);

  // Customer lookup for repeat prescription
  const { data: customer } = useQuery({
    queryKey: ["customers", "phone", pharmacyId, customerPhone],
    queryFn: () => customerApi.lookupByPhone(pharmacyId, customerPhone),
    enabled: customerPhone.length >= 9,
    retry: false,
  });

  const { data: prescription } = useQuery({
    queryKey: ["pos", "prescription", pharmacyId, customer?.id, branchId],
    queryFn: () => posApi.repeatPrescription(pharmacyId, customer!.id, branchId),
    enabled: !!customer?.id && !!branchId,
    retry: false,
  });

  // Focus barcode input on mount and after every scan
  useEffect(() => {
    barcodeRef.current?.focus();
  }, [cart]);

  const router = useRouter();
  // Sellers can't add drugs; owners and managers can.
  const canAddDrugs = useAuthStore((state) => state.user?.role !== "Seller");

  const handleBarcodeScan = useCallback(async () => {
    const code = barcodeInput.trim();
    if (!code || !branchId) return;

    // Check if already in cart
    const existing = cart.find((c) => c.drugId === code);
    if (existing) {
      updateQuantity(existing.drugId, existing.quantity + 1);
      setBarcodeInput("");
      return;
    }

    try {
      const result = await posApi.lookupBarcode(pharmacyId, code, branchId);
      addToCart(result);
    } catch {
      // Not one of this pharmacy's drugs. If the shared catalog knows the barcode, owners and managers
      // can add it in a couple of taps instead of being stuck at the till.
      if (canAddDrugs) {
        try {
          const item = await catalogApi.byBarcode(pharmacyId, code);
          if (!item.alreadyAdded) {
            toast.message(`"${item.name}" is not in your drugs yet`, {
              description: "It is in the shared catalog. Add it with your own price.",
              action: { label: "Add it", onClick: () => router.push(`/${pharmacyId}/drugs?catalog=${encodeURIComponent(code)}`) },
              duration: 12000,
            });
            setBarcodeInput("");
            return;
          }
        } catch {
          // Not in the catalog either: fall through to the plain message.
        }
      }
      toast.error(`Drug not found for barcode: ${code}`);
    }
    setBarcodeInput("");
  }, [barcodeInput, branchId, cart, pharmacyId, canAddDrugs, router]);

  function addToCart(drug: BarcodeLookupResponse) {
    const existing = cart.find((c) => c.drugId === drug.drugId);
    if (existing) {
      updateQuantity(drug.drugId, existing.quantity + 1);
      return;
    }
    setCart((prev) => [
      ...prev,
      {
        drugId: drug.drugId,
        name: drug.name,
        unitPrice: drug.sellingPrice,
        quantity: 1,
        stockAvailable: drug.stockAvailable,
      },
    ]);
  }

  function updateQuantity(drugId: string, newQty: number) {
    if (newQty <= 0) {
      removeFromCart(drugId);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.drugId === drugId ? { ...item, quantity: newQty } : item
      )
    );
  }

  function removeFromCart(drugId: string) {
    setCart((prev) => prev.filter((item) => item.drugId !== drugId));
  }

  function addPrescriptionToCart() {
    if (!prescription) return;
    prescription.items.forEach((item) => {
      if (item.inStock) {
        const existing = cart.find((c) => c.drugId === item.drugId);
        if (existing) {
          updateQuantity(item.drugId, existing.quantity + item.quantity);
        } else {
          setCart((prev) => [
            ...prev,
            {
              drugId: item.drugId,
              name: item.drugName,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              stockAvailable: 999, // Will be validated server-side
            },
          ]);
        }
      }
    });
    toast.success("Prescription items added to cart");
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Quick POS</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Scan barcodes or repeat prescriptions for fast checkout
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Scanner + Search */}
        <div className="lg:col-span-2 space-y-4">
          {/* Branch selector */}
          <div className="flex gap-3 items-end">
            <div className="space-y-1 flex-1 max-w-xs">
              <Label>Branch</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}>
                {branches?.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Barcode scanner */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ScanBarcode className="h-4 w-4" />
                Barcode Scanner
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  ref={barcodeRef}
                  placeholder="Scan barcode or type drug code…"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleBarcodeScan();
                    }
                  }}
                  className="font-mono"
                  autoFocus
                />
                <Button onClick={handleBarcodeScan} disabled={!barcodeInput.trim()}>
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                💡 Tip: Position your cursor here and scan — items auto-add on Enter
              </p>
            </CardContent>
          </Card>

          {/* Repeat Prescription */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Repeat Last Prescription
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2 items-end">
                <div className="flex-1 max-w-xs space-y-1">
                  <Label>Customer Phone</Label>
                  <Input placeholder="+255 7XX XXX XXX"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)} />
                </div>
              </div>

              {customer && (
                <p className="text-sm">
                  Customer: <span className="font-semibold">{customer.name}</span>
                </p>
              )}

              {prescription && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Last purchase: {prescription.receiptNumber} ({prescription.saleDate})
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Drug</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead>Stock</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {prescription.items.map((item) => (
                        <TableRow key={item.drugId}>
                          <TableCell>{item.drugName}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">TZS {item.unitPrice.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant={item.inStock ? "secondary" : "destructive"}>
                              {item.inStock ? "In Stock" : "Out"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <Button size="sm" onClick={addPrescriptionToCart}>
                    <Plus className="h-4 w-4 mr-1" /> Add All to Cart
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Cart */}
        <div>
          <Card className="sticky top-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Cart
                </span>
                <Badge variant="secondary">{cartItemCount} items</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {cart.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Scan a barcode to start
                </p>
              ) : (
                <>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {cart.map((item) => (
                      <div key={item.drugId}
                        className="flex items-center justify-between gap-2 border rounded-lg p-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            TZS {item.unitPrice.toLocaleString()} × {item.quantity}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="icon" className="h-7 w-7"
                            onClick={() => updateQuantity(item.drugId, item.quantity - 1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="text-sm font-semibold w-8 text-center">{item.quantity}</span>
                          <Button variant="outline" size="icon" className="h-7 w-7"
                            onClick={() => updateQuantity(item.drugId, item.quantity + 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500"
                            onClick={() => removeFromCart(item.drugId)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-semibold">TZS {cartTotal.toLocaleString()}</span>
                    </div>
                    <Button className="w-full" size="lg">
                      Proceed to Checkout →
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
