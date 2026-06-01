"use client";

import { Fragment, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

type MaterialStatus = "Disponible" | "A revisar" | "Dañado" | "Perdido";
type LoanStatus = "Activo" | "Devuelto" | "Vencido" | "Anulado";

type Material = {
  id: string;
  nombre: string;
  categoria: string;
  cantidad: number;
  ubicacion_detallada: string;
  estado: MaterialStatus;
  notas: string;
};

type Prestamo = {
  id: string;
  material_id: string;
  cantidad: number;
  responsable: string;
  motivo: string;
  fecha_salida: string;
  fecha_devolucion_esperada: string;
  estado: LoanStatus;
  notas: string;
  created_at: string;
};

function formatDateTime(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const categorias = [
  "Comida/cocina",
  "Merch/BBYO things",
  "Botiquin",
  "Ambientación",
  "Banners",
  "Librería",
  "Deporte y recreación",
  "Judaísmo",
  "Otros",
];

const responsables = [
  "Daniel",
  "Catalina",
  "Carolina",
  "Hannah",
  "Irina",
  "Uriel",
  "Matias",
  "Josefina",
  "Andy",
  "Diana",
  "Rocio",
  "Lucia",
  "Otros",
];

const estadosMaterial: MaterialStatus[] = [
  "Disponible",
  "A revisar",
  "Dañado",
  "Perdido",
];

const motivos = ["Chapter Meeting", "Evento Regional", "Otro"];

const today = new Date().toISOString().slice(0, 10);

type InventoryItem = Material & { prestada: number; disponible: number };

export default function Home() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loans, setLoans] = useState<Prestamo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoriaFilter, setCategoriaFilter] = useState("Todas");
  const [responsableFilter, setResponsableFilter] = useState("Todos");
  const [showHistorial, setShowHistorial] = useState(false);
  const [collapsedCategorias, setCollapsedCategorias] = useState<Set<string>>(new Set());
  const categoriasInitialized = useRef(false);
  const [editingMaterial, setEditingMaterial] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    nombre: "",
    categoria: categorias[0],
    cantidad: 1,
    ubicacion_detallada: "",
    estado: "Disponible" as MaterialStatus,
    notas: "",
    categoriaCustom: "",
  });
  const [newMaterial, setNewMaterial] = useState({
    nombre: "",
    categoria: categorias[0],
    cantidad: 1,
    ubicacion_detallada: "",
    estado: estadosMaterial[0],
    notas: "",
  });
  const [newLoan, setNewLoan] = useState({
    materialId: "",
    cantidad: 1,
    responsable: responsables[0],
    motivo: motivos[0],
    fecha_salida: today,
    fecha_devolucion_esperada: today,
    notas: "",
  });
  const [categoriaCustom, setCategoriaCustom] = useState("");
  const [responsableCustom, setResponsableCustom] = useState("");

  const loadData = useCallback(async () => {
    const [{ data: matsData }, { data: loansData }] = await Promise.all([
      supabase.from("materiales").select("*").order("created_at"),
      supabase.from("prestamos").select("*").order("created_at"),
    ]);
    if (matsData) setMaterials(matsData as Material[]);
    if (loansData) setLoans(loansData as Prestamo[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel("db-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "materiales" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "prestamos" }, loadData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  useEffect(() => {
    if (!categoriasInitialized.current && materials.length > 0) {
      categoriasInitialized.current = true;
      setCollapsedCategorias(new Set(materials.map((m) => m.categoria)));
    }
  }, [materials]);

  useEffect(() => {
    if (materials.length > 0 && !newLoan.materialId) {
      setNewLoan((c) => ({ ...c, materialId: materials[0].id }));
    }
  }, [materials, newLoan.materialId]);

  const cantidadPrestadaPorMaterial = useMemo(() => {
    return loans.reduce<Record<string, number>>((acc, loan) => {
      if (loan.estado === "Activo" || loan.estado === "Vencido") {
        acc[loan.material_id] = (acc[loan.material_id] ?? 0) + loan.cantidad;
      }
      return acc;
    }, {});
  }, [loans]);

  const inventory = useMemo((): InventoryItem[] => {
    return materials.map((material) => {
      const prestada = cantidadPrestadaPorMaterial[material.id] ?? 0;
      return { ...material, prestada, disponible: Math.max(material.cantidad - prestada, 0) };
    });
  }, [cantidadPrestadaPorMaterial, materials]);

  const uniqueCategorias = useMemo(
    () => [...new Set(materials.map((m) => m.categoria))].sort(),
    [materials],
  );

  const filteredInventory = useMemo(() => {
    let result = inventory;
    if (categoriaFilter !== "Todas") result = result.filter((m) => m.categoria === categoriaFilter);
    const q = search.trim().toLowerCase();
    if (q) result = result.filter((m) =>
      [m.nombre, m.categoria, m.ubicacion_detallada].some((f) => f.toLowerCase().includes(q)),
    );
    return result;
  }, [inventory, search, categoriaFilter]);

  const groupedInventory = useMemo(() => {
    const groups: Record<string, InventoryItem[]> = {};
    for (const item of filteredInventory) {
      if (!groups[item.categoria]) groups[item.categoria] = [];
      groups[item.categoria].push(item);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b, "es"));
  }, [filteredInventory]);

  const activeLoans = useMemo(() => {
    return loans
      .filter((l) => l.estado === "Activo" || l.estado === "Vencido")
      .map((l) => ({
        ...l,
        estado: l.fecha_devolucion_esperada < today ? ("Vencido" as LoanStatus) : l.estado,
        material: materials.find((m) => m.id === l.material_id)?.nombre ?? "Material eliminado",
      }));
  }, [loans, materials]);

  const uniqueResponsables = useMemo(
    () => [...new Set(activeLoans.map((l) => l.responsable))],
    [activeLoans],
  );

  const filteredActiveLoans = useMemo(() => {
    if (responsableFilter === "Todos") return activeLoans;
    return activeLoans.filter((l) => l.responsable === responsableFilter);
  }, [activeLoans, responsableFilter]);

  const closedLoans = useMemo(() => {
    return loans
      .filter((l) => l.estado === "Devuelto" || l.estado === "Anulado")
      .map((l) => ({
        ...l,
        material: materials.find((m) => m.id === l.material_id)?.nombre ?? "Material eliminado",
      }))
      .slice()
      .reverse();
  }, [loans, materials]);

  const stats = useMemo(() => ({
    totalMateriales: materials.length,
    enPrestamo: loans.filter((l) => l.estado === "Activo" || l.estado === "Vencido").length,
    vencidos: loans.filter(
      (l) => (l.estado === "Activo" || l.estado === "Vencido") && l.fecha_devolucion_esperada < today,
    ).length,
  }), [materials, loans]);

  const selectedMaterial = inventory.find((m) => m.id === newLoan.materialId);

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleAddMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cat = newMaterial.categoria === "Otros" ? categoriaCustom.trim() : newMaterial.categoria;
    if (!newMaterial.nombre.trim() || !newMaterial.ubicacion_detallada.trim() || !cat) return;

    const { data, error } = await supabase
      .from("materiales")
      .insert({
        nombre: newMaterial.nombre.trim(),
        categoria: cat,
        cantidad: Number(newMaterial.cantidad),
        ubicacion_detallada: newMaterial.ubicacion_detallada.trim(),
        estado: newMaterial.estado,
        notas: newMaterial.notas.trim(),
      })
      .select()
      .single();

    if (error) { alert(`Error al guardar: ${error.message}`); return; }

    setNewMaterial({ nombre: "", categoria: categorias[0], cantidad: 1, ubicacion_detallada: "", estado: estadosMaterial[0], notas: "" });
    setCategoriaCustom("");
    if (data) setNewLoan((c) => ({ ...c, materialId: data.id, cantidad: 1 }));
    await loadData();
  }

  function handleStartEdit(item: InventoryItem) {
    const isCustom = !categorias.slice(0, -1).includes(item.categoria);
    setEditForm({
      nombre: item.nombre,
      categoria: isCustom ? "Otros" : item.categoria,
      cantidad: item.cantidad,
      ubicacion_detallada: item.ubicacion_detallada,
      estado: item.estado,
      notas: item.notas,
      categoriaCustom: isCustom ? item.categoria : "",
    });
    setEditingMaterial(item.id);
  }

  async function handleSaveEdit(materialId: string, prestada: number) {
    const cat = editForm.categoria === "Otros" ? editForm.categoriaCustom.trim() : editForm.categoria;
    if (!editForm.nombre.trim() || !editForm.ubicacion_detallada.trim() || !cat) return;
    const { error } = await supabase
      .from("materiales")
      .update({
        nombre: editForm.nombre.trim(),
        categoria: cat,
        cantidad: Math.max(Number(editForm.cantidad), prestada),
        ubicacion_detallada: editForm.ubicacion_detallada.trim(),
        estado: editForm.estado,
        notas: editForm.notas.trim(),
      })
      .eq("id", materialId);
    if (error) { alert(`Error: ${error.message}`); return; }
    setEditingMaterial(null);
    await loadData();
  }

  async function handleQuickQuantity(materialId: string, delta: number, current: number, minQty: number) {
    const next = current + delta;
    if (next < minQty) return;
    const { error } = await supabase.from("materiales").update({ cantidad: next }).eq("id", materialId);
    if (!error) await loadData();
  }

  async function handleAddLoan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const resp = newLoan.responsable === "Otros" ? responsableCustom.trim() : newLoan.responsable;
    if (!selectedMaterial || !resp) return;
    const qty = Number(newLoan.cantidad);
    if (qty < 1 || qty > selectedMaterial.disponible) return;

    const { error } = await supabase.from("prestamos").insert({
      material_id: newLoan.materialId,
      cantidad: qty,
      responsable: resp,
      motivo: newLoan.motivo,
      fecha_salida: newLoan.fecha_salida,
      fecha_devolucion_esperada: newLoan.fecha_devolucion_esperada,
      estado: newLoan.fecha_devolucion_esperada < today ? "Vencido" : "Activo",
      notas: newLoan.notas.trim(),
    });

    if (error) { alert(`Error al guardar: ${error.message}`); return; }

    setNewLoan({ materialId: newLoan.materialId, cantidad: 1, responsable: responsables[0], motivo: motivos[0], fecha_salida: today, fecha_devolucion_esperada: today, notas: "" });
    setResponsableCustom("");
    await loadData();
  }

  async function handleReturnLoan(loanId: string) {
    const { error } = await supabase.from("prestamos").update({ estado: "Devuelto" }).eq("id", loanId);
    if (!error) await loadData();
  }

  async function handleAnnulLoan(loanId: string) {
    if (!confirm("¿Marcar como no devuelto? El préstamo se cerrará y la cantidad se descontará del inventario.")) return;
    const loan = loans.find((l) => l.id === loanId);
    if (!loan) return;
    const material = materials.find((m) => m.id === loan.material_id);
    const nuevaCantidad = Math.max((material?.cantidad ?? 0) - loan.cantidad, 0);
    const [{ error: loanError }, { error: matError }] = await Promise.all([
      supabase.from("prestamos").update({ estado: "Anulado" }).eq("id", loanId),
      supabase.from("materiales").update({ cantidad: nuevaCantidad }).eq("id", loan.material_id),
    ]);
    if (loanError) { alert(`Error: ${loanError.message}`); return; }
    if (matError) { alert(`Error: ${matError.message}`); return; }
    await loadData();
  }

  async function handleDeleteMaterial(materialId: string, nombre: string) {
    if (!confirm(`¿Eliminar "${nombre}"? Se borran también sus préstamos. No se puede deshacer.`)) return;
    const { error } = await supabase.from("materiales").delete().eq("id", materialId);
    if (error) { alert(`Error: ${error.message}`); return; }
    await loadData();
  }

  function exportCSV() {
    const headers = ["Nombre", "Categoría", "Total", "Disponible", "En préstamo", "Ubicación", "Estado", "Notas"];
    const rows = inventory.map((i) => [i.nombre, i.categoria, i.cantidad, i.disponible, i.prestada, i.ubicacion_detallada, i.estado, i.notas]);
    const csv = [headers, ...rows]
      .map((row) => row.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bbyo-deposito-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function toggleCategoria(cat: string) {
    setCollapsedCategorias((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  // ── Styles ────────────────────────────────────────────────────────────────

  const panelClass = "rounded-lg border border-[#D7E7F6] bg-white shadow-sm";
  const fieldClass = "rounded-md border border-[#C9D8E6] bg-white px-3 py-2 text-zinc-900 outline-none transition focus:border-[#0072BC] focus:ring-2 focus:ring-[#0072BC]/15";
  const labelClass = "flex flex-col gap-2 text-sm font-medium text-[#243746]";
  const editFieldClass = "w-full rounded border border-[#C9D8E6] bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:border-[#0072BC]";

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F5F8FB]">
        <p className="text-zinc-500">Cargando inventario...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F5F8FB] px-4 py-6 text-[#1F2D3A] sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">

        {/* ── Header ── */}
        <header className="overflow-hidden rounded-lg border border-[#D7E7F6] bg-white shadow-sm">
          <div className="h-2 bg-[#F9A01B]" />
          <div className="flex flex-col gap-5 px-4 py-5 sm:px-5 sm:py-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
                <div className="flex h-12 w-36 items-center sm:h-16 sm:w-44">
                  <Image src="/bbyo-logo-argentina.png" alt="BBYO Argentina" width={210} height={95} priority className="h-auto w-full" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-[#0072BC] sm:text-4xl">BBYO Depósito</h1>
                  <p className="mt-1 text-sm text-zinc-600 sm:mt-2 sm:text-lg">Inventario y préstamos de materiales</p>
                </div>
              </div>
              <div className="rounded-md border border-[#D7E7F6] bg-[#F5F8FB] px-3 py-2 text-sm font-medium text-[#0072BC] sm:px-4 sm:py-3">
                Depósito único: Huerta
              </div>
            </div>
            {/* Stats */}
            <div className="flex flex-wrap gap-3">
              <div className="rounded-md bg-[#EEF6FC] px-4 py-2 text-sm">
                <span className="font-semibold text-[#0072BC]">{stats.totalMateriales}</span>
                <span className="ml-1 text-zinc-600">ítems</span>
              </div>
              <div className="rounded-md bg-[#FFF4DF] px-4 py-2 text-sm">
                <span className="font-semibold text-[#A66000]">{stats.enPrestamo}</span>
                <span className="ml-1 text-zinc-600">en préstamo</span>
              </div>
              <div className={`rounded-md px-4 py-2 text-sm ${stats.vencidos > 0 ? "bg-red-50" : "bg-zinc-100"}`}>
                <span className={`font-semibold ${stats.vencidos > 0 ? "text-red-600" : "text-zinc-500"}`}>{stats.vencidos}</span>
                <span className={`ml-1 ${stats.vencidos > 0 ? "text-red-500" : "text-zinc-500"}`}>vencidos</span>
              </div>
            </div>
          </div>
        </header>

        {/* ── Forms ── */}
        <section className="order-3 grid gap-6 lg:grid-cols-[1.3fr_1fr]">

          {/* Agregar material */}
          <div className={panelClass}>
            <div className="border-b border-[#D7E7F6] px-5 py-4">
              <h2 className="text-lg font-semibold text-[#0072BC]">Agregar material</h2>
            </div>
            <form onSubmit={handleAddMaterial} className="grid gap-4 p-5 sm:grid-cols-2">
              <label className={labelClass}>
                Nombre
                <input value={newMaterial.nombre} onChange={(e) => setNewMaterial({ ...newMaterial, nombre: e.target.value })} className={fieldClass} placeholder="Ej: Micrófono" required />
              </label>

              <div className={labelClass}>
                Categoría
                <select value={newMaterial.categoria} onChange={(e) => setNewMaterial({ ...newMaterial, categoria: e.target.value })} className={fieldClass}>
                  {categorias.map((c) => <option key={c}>{c}</option>)}
                </select>
                {newMaterial.categoria === "Otros" && (
                  <input value={categoriaCustom} onChange={(e) => setCategoriaCustom(e.target.value)} className={fieldClass} placeholder="Escribí la categoría" required />
                )}
              </div>

              <label className={labelClass}>
                Cantidad
                <input type="number" min="1" value={newMaterial.cantidad} onChange={(e) => setNewMaterial({ ...newMaterial, cantidad: Number(e.target.value) })} className={fieldClass} required />
              </label>

              <label className={labelClass}>
                Estado
                <select value={newMaterial.estado} onChange={(e) => setNewMaterial({ ...newMaterial, estado: e.target.value as MaterialStatus })} className={fieldClass}>
                  {estadosMaterial.map((e) => <option key={e}>{e}</option>)}
                </select>
              </label>

              <label className={`${labelClass} sm:col-span-2`}>
                Ubicación detallada
                <input value={newMaterial.ubicacion_detallada} onChange={(e) => setNewMaterial({ ...newMaterial, ubicacion_detallada: e.target.value })} className={fieldClass} placeholder="Ej: Huerta - estante superior" required />
              </label>

              <label className={`${labelClass} sm:col-span-2`}>
                Notas
                <textarea value={newMaterial.notas} onChange={(e) => setNewMaterial({ ...newMaterial, notas: e.target.value })} className={`${fieldClass} min-h-20`} placeholder="Detalle opcional" />
              </label>

              <button type="submit" className="rounded-md bg-[#0072BC] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#005C96] sm:col-span-2">
                Agregar material
              </button>
            </form>
          </div>

          {/* Registrar préstamo */}
          <div className={panelClass}>
            <div className="border-b border-[#D7E7F6] px-5 py-4">
              <h2 className="text-lg font-semibold text-[#0072BC]">Registrar préstamo</h2>
            </div>
            <form onSubmit={handleAddLoan} className="flex flex-col gap-4 p-5">
              <label className={labelClass}>
                Material
                <select value={newLoan.materialId} onChange={(e) => setNewLoan({ ...newLoan, materialId: e.target.value, cantidad: 1 })} className={fieldClass}>
                  {inventory.map((m) => <option key={m.id} value={m.id}>{m.nombre} ({m.disponible} disp.)</option>)}
                </select>
              </label>

              <label className={labelClass}>
                Cantidad
                <input type="number" min="1" max={selectedMaterial?.disponible ?? 1} value={newLoan.cantidad} onChange={(e) => setNewLoan({ ...newLoan, cantidad: Number(e.target.value) })} className={fieldClass} required />
              </label>

              <div className={labelClass}>
                Responsable
                <select value={newLoan.responsable} onChange={(e) => setNewLoan({ ...newLoan, responsable: e.target.value })} className={fieldClass}>
                  {responsables.map((r) => <option key={r}>{r}</option>)}
                </select>
                {newLoan.responsable === "Otros" && (
                  <input value={responsableCustom} onChange={(e) => setResponsableCustom(e.target.value)} className={fieldClass} placeholder="Escribí el responsable" required />
                )}
              </div>

              <label className={labelClass}>
                Motivo
                <select value={newLoan.motivo} onChange={(e) => setNewLoan({ ...newLoan, motivo: e.target.value })} className={fieldClass}>
                  {motivos.map((m) => <option key={m}>{m}</option>)}
                </select>
              </label>

              <label className={labelClass}>
                Devolución esperada
                <input type="date" value={newLoan.fecha_devolucion_esperada} onChange={(e) => setNewLoan({ ...newLoan, fecha_devolucion_esperada: e.target.value })} className={fieldClass} />
              </label>

              <label className={labelClass}>
                Notas
                <textarea value={newLoan.notas} onChange={(e) => setNewLoan({ ...newLoan, notas: e.target.value })} className={`${fieldClass} min-h-20`} placeholder="Detalle opcional" />
              </label>

              <button type="submit" disabled={!selectedMaterial || selectedMaterial.disponible < 1} className="rounded-md bg-[#F9A01B] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#D88912] disabled:cursor-not-allowed disabled:bg-zinc-300">
                Registrar préstamo
              </button>
            </form>
          </div>
        </section>

        {/* ── Inventario + Préstamos activos ── */}
        <section className="order-2 grid gap-6 lg:grid-cols-[1.4fr_1fr]">

          {/* Inventario */}
          <div className={panelClass}>
            <div className="flex flex-col gap-3 border-b border-[#D7E7F6] px-5 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#0072BC]">Inventario</h2>
                <button type="button" onClick={exportCSV} className="rounded-md border border-[#C9D8E6] px-3 py-1.5 text-xs font-medium text-[#0072BC] transition hover:bg-[#EEF6FC]">
                  Exportar CSV
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <select value={categoriaFilter} onChange={(e) => setCategoriaFilter(e.target.value)} className={`${fieldClass} text-sm`}>
                  <option value="Todas">Todas las categorías</option>
                  {uniqueCategorias.map((c) => <option key={c}>{c}</option>)}
                </select>
                <input value={search} onChange={(e) => setSearch(e.target.value)} className={`${fieldClass} flex-1 text-sm`} placeholder="Buscar por nombre, categoría o ubicación" />
              </div>
            </div>

            {/* Mobile cards — agrupadas por categoría */}
            <div className="divide-y divide-zinc-100 md:hidden">
              {groupedInventory.map(([cat, items]) => {
                const collapsed = collapsedCategorias.has(cat);
                return (
                  <div key={cat}>
                    <button type="button" onClick={() => toggleCategoria(cat)} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[#F5F8FB]">
                      <span className="font-semibold text-[#0072BC]">{cat}</span>
                      <span className="flex items-center gap-2">
                        <span className="rounded-full bg-[#EEF6FC] px-2 py-0.5 text-xs font-medium text-zinc-500">{items.length}</span>
                        <span className="text-xs text-zinc-400">{collapsed ? "▶" : "▼"}</span>
                      </span>
                    </button>
                    {!collapsed && (
                      <div className="grid gap-3 p-4 pt-2">
                        {items.map((item) => (
                          <article key={item.id} className={`rounded-lg border p-4 ${editingMaterial === item.id ? "border-[#0072BC]/30 bg-[#EEF6FC]" : "border-[#D7E7F6] bg-[#F8FBFE]"}`}>
                            {editingMaterial === item.id ? (
                              <div className="flex flex-col gap-3">
                                <input value={editForm.nombre} onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })} className={fieldClass} placeholder="Nombre" />
                                <select value={editForm.categoria} onChange={(e) => setEditForm({ ...editForm, categoria: e.target.value })} className={fieldClass}>
                                  {categorias.map((c) => <option key={c}>{c}</option>)}
                                </select>
                                {editForm.categoria === "Otros" && (
                                  <input value={editForm.categoriaCustom} onChange={(e) => setEditForm({ ...editForm, categoriaCustom: e.target.value })} className={fieldClass} placeholder="Categoría personalizada" />
                                )}
                                <div className="grid grid-cols-2 gap-3">
                                  <label className={labelClass}>
                                    Cantidad
                                    <input type="number" min={item.prestada} value={editForm.cantidad} onChange={(e) => setEditForm({ ...editForm, cantidad: Number(e.target.value) })} className={fieldClass} />
                                  </label>
                                  <label className={labelClass}>
                                    Estado
                                    <select value={editForm.estado} onChange={(e) => setEditForm({ ...editForm, estado: e.target.value as MaterialStatus })} className={fieldClass}>
                                      {estadosMaterial.map((e) => <option key={e}>{e}</option>)}
                                    </select>
                                  </label>
                                </div>
                                <input value={editForm.ubicacion_detallada} onChange={(e) => setEditForm({ ...editForm, ubicacion_detallada: e.target.value })} className={fieldClass} placeholder="Ubicación detallada" />
                                <textarea value={editForm.notas} onChange={(e) => setEditForm({ ...editForm, notas: e.target.value })} className={`${fieldClass} min-h-16`} placeholder="Notas" />
                                <div className="flex gap-2">
                                  <button type="button" onClick={() => handleSaveEdit(item.id, item.prestada)} className="flex-1 rounded-md bg-[#0072BC] px-3 py-2 text-sm font-semibold text-white hover:bg-[#005C96]">Guardar</button>
                                  <button type="button" onClick={() => setEditingMaterial(null)} className="flex-1 rounded-md border border-[#C9D8E6] px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50">Cancelar</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-start justify-between gap-3">
                                  <h3 className="font-semibold text-zinc-900">{item.nombre}</h3>
                                  <span className="shrink-0 rounded-md bg-white px-3 py-1 text-sm font-semibold text-[#0072BC]">{item.disponible} disp.</span>
                                </div>
                                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                                  <div>
                                    <dt className="text-zinc-500">Total</dt>
                                    <dd className="flex items-center gap-1.5 font-medium text-zinc-900">
                                      <button type="button" onClick={() => handleQuickQuantity(item.id, -1, item.cantidad, item.prestada)} disabled={item.cantidad <= item.prestada} className="flex h-5 w-5 items-center justify-center rounded border border-zinc-300 text-xs hover:bg-zinc-100 disabled:opacity-40">−</button>
                                      {item.cantidad}
                                      <button type="button" onClick={() => handleQuickQuantity(item.id, 1, item.cantidad, item.prestada)} className="flex h-5 w-5 items-center justify-center rounded border border-zinc-300 text-xs hover:bg-zinc-100">+</button>
                                    </dd>
                                  </div>
                                  <div><dt className="text-zinc-500">Prestado</dt><dd className="font-medium text-zinc-900">{item.prestada}</dd></div>
                                  <div><dt className="text-zinc-500">Estado</dt><dd className="font-medium text-zinc-900">{item.estado}</dd></div>
                                  <div><dt className="text-zinc-500">Ubicación</dt><dd className="font-medium text-zinc-900">{item.ubicacion_detallada}</dd></div>
                                </dl>
                                {item.notas && <p className="mt-2 text-sm text-zinc-500">{item.notas}</p>}
                                <div className="mt-3 flex gap-2">
                                  <button type="button" onClick={() => handleStartEdit(item)} className="flex-1 rounded-md border border-[#C9D8E6] px-3 py-2 text-sm font-medium text-[#0072BC] hover:bg-[#EEF6FC]">Editar</button>
                                  <button type="button" onClick={() => handleDeleteMaterial(item.id, item.nombre)} className="flex-1 rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">Eliminar</button>
                                </div>
                              </>
                            )}
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop table — agrupada por categoría */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="bg-[#EEF6FC] text-[#33566F]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Material</th>
                    <th className="px-4 py-3 font-medium">Ubicación</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                    <th className="px-4 py-3 font-medium">Prestado</th>
                    <th className="px-4 py-3 font-medium">Disponible</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {groupedInventory.map(([cat, items]) => {
                    const collapsed = collapsedCategorias.has(cat);
                    return (
                      <Fragment key={cat}>
                        <tr className="cursor-pointer bg-[#F0F7FD] hover:bg-[#E5F0FA]" onClick={() => toggleCategoria(cat)}>
                          <td colSpan={7} className="px-4 py-2">
                            <span className="flex items-center gap-2 font-semibold text-[#0072BC]">
                              <span className="text-xs">{collapsed ? "▶" : "▼"}</span>
                              {cat}
                              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-zinc-500">{items.length}</span>
                            </span>
                          </td>
                        </tr>
                        {!collapsed && items.map((item) =>
                          editingMaterial === item.id ? (
                            <tr key={item.id} className="bg-[#EEF6FC]">
                              <td className="px-3 py-2"><input value={editForm.nombre} onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })} className={editFieldClass} /></td>
                              <td className="px-3 py-2"><input value={editForm.ubicacion_detallada} onChange={(e) => setEditForm({ ...editForm, ubicacion_detallada: e.target.value })} className={editFieldClass} /></td>
                              <td className="px-3 py-2">
                                <select value={editForm.estado} onChange={(e) => setEditForm({ ...editForm, estado: e.target.value as MaterialStatus })} className={editFieldClass}>
                                  {estadosMaterial.map((e) => <option key={e}>{e}</option>)}
                                </select>
                              </td>
                              <td className="px-3 py-2"><input type="number" min={item.prestada} value={editForm.cantidad} onChange={(e) => setEditForm({ ...editForm, cantidad: Number(e.target.value) })} className={`${editFieldClass} w-16`} /></td>
                              <td className="px-3 py-2 text-zinc-600">{item.prestada}</td>
                              <td className="px-3 py-2 font-semibold text-[#0072BC]">{Math.max(Number(editForm.cantidad) - item.prestada, 0)}</td>
                              <td className="px-3 py-2">
                                <div className="flex gap-1">
                                  <button type="button" onClick={() => handleSaveEdit(item.id, item.prestada)} className="rounded bg-[#0072BC] px-2 py-1 text-xs font-semibold text-white hover:bg-[#005C96]">Guardar</button>
                                  <button type="button" onClick={() => setEditingMaterial(null)} className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50">Cancelar</button>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            <tr key={item.id} className="border-t border-zinc-100 hover:bg-[#F8FBFE]">
                              <td className="px-4 py-3 font-medium text-zinc-900">{item.nombre}</td>
                              <td className="px-4 py-3 text-zinc-600">{item.ubicacion_detallada}</td>
                              <td className="px-4 py-3 text-zinc-600">{item.estado}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1">
                                  <button type="button" onClick={() => handleQuickQuantity(item.id, -1, item.cantidad, item.prestada)} disabled={item.cantidad <= item.prestada} className="flex h-5 w-5 items-center justify-center rounded border border-zinc-300 text-xs hover:bg-zinc-100 disabled:opacity-40">−</button>
                                  <span className="w-6 text-center text-zinc-700">{item.cantidad}</span>
                                  <button type="button" onClick={() => handleQuickQuantity(item.id, 1, item.cantidad, item.prestada)} className="flex h-5 w-5 items-center justify-center rounded border border-zinc-300 text-xs hover:bg-zinc-100">+</button>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-zinc-600">{item.prestada}</td>
                              <td className="px-4 py-3 font-semibold text-[#0072BC]">{item.disponible}</td>
                              <td className="px-4 py-3">
                                <div className="flex gap-1">
                                  <button type="button" onClick={() => handleStartEdit(item)} className="rounded border border-[#C9D8E6] px-2 py-1 text-xs font-medium text-[#0072BC] hover:bg-[#EEF6FC]">Editar</button>
                                  <button type="button" onClick={() => handleDeleteMaterial(item.id, item.nombre)} className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50">Eliminar</button>
                                </div>
                              </td>
                            </tr>
                          ),
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Préstamos activos */}
          <div className={panelClass}>
            <div className="flex flex-col gap-3 border-b border-[#D7E7F6] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-[#0072BC]">Préstamos activos</h2>
              {uniqueResponsables.length > 1 && (
                <select value={responsableFilter} onChange={(e) => setResponsableFilter(e.target.value)} className={`${fieldClass} text-sm`}>
                  <option value="Todos">Todos</option>
                  {uniqueResponsables.map((r) => <option key={r}>{r}</option>)}
                </select>
              )}
            </div>
            <div className="divide-y divide-zinc-100">
              {filteredActiveLoans.length === 0 ? (
                <p className="px-5 py-6 text-sm text-zinc-600">No hay préstamos activos.</p>
              ) : (
                filteredActiveLoans.map((loan) => (
                  <div key={loan.id} className="flex flex-col gap-4 px-5 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div>
                        <p className="font-medium text-zinc-900">{loan.material}</p>
                        <p className="text-sm text-zinc-600">{loan.cantidad} unidad(es) · {loan.responsable}</p>
                        <p className="mt-1 text-sm text-zinc-500">{loan.motivo} · Devuelve: {loan.fecha_devolucion_esperada}</p>
                        <p className="mt-0.5 text-xs text-zinc-400">Retirado: {formatDateTime(loan.created_at)}</p>
                      </div>
                      <span className={loan.estado === "Vencido" ? "rounded-md bg-red-50 px-3 py-1 text-sm font-medium text-red-700" : "rounded-md bg-[#FFF4DF] px-3 py-1 text-sm font-medium text-[#A66000]"}>
                        {loan.estado}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button type="button" onClick={() => handleReturnLoan(loan.id)} className="rounded-md border border-[#C9D8E6] px-3 py-2 text-sm font-semibold text-[#0072BC] transition hover:bg-[#F5F8FB]">
                        Registrar devolución
                      </button>
                      <button type="button" onClick={() => handleAnnulLoan(loan.id)} className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50">
                        No vuelve
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* ── Historial ── */}
        <section className="order-last">
          <div className={panelClass}>
            <button
              type="button"
              onClick={() => setShowHistorial(!showHistorial)}
              className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-[#F5F8FB]"
            >
              <h2 className="text-lg font-semibold text-[#0072BC]">
                Historial
                {closedLoans.length > 0 && (
                  <span className="ml-2 rounded-full bg-[#EEF6FC] px-2 py-0.5 text-sm font-normal text-zinc-600">
                    {closedLoans.length}
                  </span>
                )}
              </h2>
              <span className="text-zinc-400 text-sm">{showHistorial ? "▲ Ocultar" : "▼ Ver"}</span>
            </button>
            {showHistorial && (
              <div className="divide-y divide-zinc-100">
                {closedLoans.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-zinc-600">No hay préstamos cerrados aún.</p>
                ) : (
                  closedLoans.map((loan) => (
                    <div key={loan.id} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium text-zinc-800">{loan.material}</p>
                        <p className="text-sm text-zinc-500">{loan.cantidad} unidad(es) · {loan.responsable} · {loan.motivo}</p>
                        <p className="text-xs text-zinc-400">Retirado: {formatDateTime(loan.created_at)} · Devol. esperada: {loan.fecha_devolucion_esperada}</p>
                      </div>
                      <span className={loan.estado === "Anulado" ? "mt-1 rounded-md bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 sm:mt-0" : "mt-1 rounded-md bg-green-50 px-3 py-1 text-xs font-medium text-green-700 sm:mt-0"}>
                        {loan.estado === "Anulado" ? "No volvió" : "Devuelto"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </section>

      </div>
    </main>
  );
}
