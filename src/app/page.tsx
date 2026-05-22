"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

type MaterialStatus = "Disponible" | "A revisar" | "Dañado" | "Perdido";
type LoanStatus = "Activo" | "Devuelto" | "Vencido";

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
};

const categorias = [
  "Audio y técnica",
  "Libreria",
  "material brandeado",
  "Judaica y Shabat",
  "Juegos y recreación",
  "Oficina",
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

export default function Home() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loans, setLoans] = useState<Prestamo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
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
    responsable: "",
    motivo: motivos[0],
    fecha_salida: today,
    fecha_devolucion_esperada: today,
    notas: "",
  });

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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "materiales" },
        loadData,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "prestamos" },
        loadData,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  useEffect(() => {
    if (materials.length > 0 && !newLoan.materialId) {
      setNewLoan((current) => ({ ...current, materialId: materials[0].id }));
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

  const inventory = useMemo(() => {
    return materials.map((material) => {
      const prestada = cantidadPrestadaPorMaterial[material.id] ?? 0;
      return {
        ...material,
        prestada,
        disponible: Math.max(material.cantidad - prestada, 0),
      };
    });
  }, [cantidadPrestadaPorMaterial, materials]);

  const filteredInventory = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return inventory;
    return inventory.filter((material) =>
      [material.nombre, material.categoria, material.ubicacion_detallada].some(
        (field) => field.toLowerCase().includes(normalizedSearch),
      ),
    );
  }, [inventory, search]);

  const activeLoans = useMemo(() => {
    return loans
      .filter((loan) => loan.estado === "Activo" || loan.estado === "Vencido")
      .map((loan) => ({
        ...loan,
        estado:
          loan.fecha_devolucion_esperada < today ? "Vencido" : loan.estado,
        material:
          materials.find((material) => material.id === loan.material_id)
            ?.nombre ?? "Material eliminado",
      }));
  }, [loans, materials]);

  const selectedMaterial = inventory.find(
    (material) => material.id === newLoan.materialId,
  );

  async function handleAddMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newMaterial.nombre.trim() || !newMaterial.ubicacion_detallada.trim()) {
      return;
    }

    const { data } = await supabase
      .from("materiales")
      .insert({
        nombre: newMaterial.nombre.trim(),
        categoria: newMaterial.categoria,
        cantidad: Number(newMaterial.cantidad),
        ubicacion_detallada: newMaterial.ubicacion_detallada.trim(),
        estado: newMaterial.estado,
        notas: newMaterial.notas.trim(),
      })
      .select()
      .single();

    setNewMaterial({
      nombre: "",
      categoria: categorias[0],
      cantidad: 1,
      ubicacion_detallada: "",
      estado: estadosMaterial[0],
      notas: "",
    });

    if (data) {
      setNewLoan((current) => ({ ...current, materialId: data.id, cantidad: 1 }));
    }
  }

  async function handleAddLoan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedMaterial || !newLoan.responsable.trim()) return;

    const requestedQuantity = Number(newLoan.cantidad);
    if (
      requestedQuantity < 1 ||
      requestedQuantity > selectedMaterial.disponible
    ) {
      return;
    }

    await supabase.from("prestamos").insert({
      material_id: newLoan.materialId,
      cantidad: requestedQuantity,
      responsable: newLoan.responsable.trim(),
      motivo: newLoan.motivo,
      fecha_salida: newLoan.fecha_salida,
      fecha_devolucion_esperada: newLoan.fecha_devolucion_esperada,
      estado:
        newLoan.fecha_devolucion_esperada < today ? "Vencido" : "Activo",
      notas: newLoan.notas.trim(),
    });

    setNewLoan({
      materialId: newLoan.materialId,
      cantidad: 1,
      responsable: "",
      motivo: motivos[0],
      fecha_salida: today,
      fecha_devolucion_esperada: today,
      notas: "",
    });
  }

  async function handleReturnLoan(loanId: string) {
    await supabase
      .from("prestamos")
      .update({ estado: "Devuelto" })
      .eq("id", loanId);
  }

  const panelClass = "rounded-lg border border-[#D7E7F6] bg-white shadow-sm";
  const fieldClass =
    "rounded-md border border-[#C9D8E6] bg-white px-3 py-2 text-zinc-900 outline-none transition focus:border-[#0072BC] focus:ring-2 focus:ring-[#0072BC]/15";
  const labelClass = "flex flex-col gap-2 text-sm font-medium text-[#243746]";

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
        <header className="overflow-hidden rounded-lg border border-[#D7E7F6] bg-white shadow-sm">
          <div className="h-2 bg-[#F9A01B]" />
          <div className="flex flex-col gap-5 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
              <div className="flex h-12 w-36 items-center sm:h-16 sm:w-44">
                <Image
                  src="/bbyo-logo-argentina.png"
                  alt="BBYO Argentina"
                  width={210}
                  height={95}
                  priority
                  className="h-auto w-full"
                />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-[#0072BC] sm:text-4xl">
                  BBYO Depósito
                </h1>
                <p className="mt-1 text-sm text-zinc-600 sm:mt-2 sm:text-lg">
                  Inventario y préstamos de materiales
                </p>
              </div>
            </div>
            <div className="rounded-md border border-[#D7E7F6] bg-[#F5F8FB] px-3 py-2 text-sm font-medium text-[#0072BC] sm:px-4 sm:py-3">
              Depósito único: Huerta
            </div>
          </div>
        </header>

        <section className="order-3 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className={panelClass}>
            <div className="border-b border-[#D7E7F6] px-5 py-4">
              <h2 className="text-lg font-semibold text-[#0072BC]">
                Agregar material
              </h2>
            </div>
            <form
              onSubmit={handleAddMaterial}
              className="grid gap-4 p-5 sm:grid-cols-2"
            >
              <label className={labelClass}>
                Nombre
                <input
                  value={newMaterial.nombre}
                  onChange={(event) =>
                    setNewMaterial({
                      ...newMaterial,
                      nombre: event.target.value,
                    })
                  }
                  className={fieldClass}
                  placeholder="Ej: Micrófono"
                  required
                />
              </label>

              <label className={labelClass}>
                Categoría
                <select
                  value={newMaterial.categoria}
                  onChange={(event) =>
                    setNewMaterial({
                      ...newMaterial,
                      categoria: event.target.value,
                    })
                  }
                  className={fieldClass}
                >
                  {categorias.map((categoria) => (
                    <option key={categoria}>{categoria}</option>
                  ))}
                </select>
              </label>

              <label className={labelClass}>
                Cantidad
                <input
                  type="number"
                  min="1"
                  value={newMaterial.cantidad}
                  onChange={(event) =>
                    setNewMaterial({
                      ...newMaterial,
                      cantidad: Number(event.target.value),
                    })
                  }
                  className={fieldClass}
                  required
                />
              </label>

              <label className={labelClass}>
                Estado
                <select
                  value={newMaterial.estado}
                  onChange={(event) =>
                    setNewMaterial({
                      ...newMaterial,
                      estado: event.target.value as MaterialStatus,
                    })
                  }
                  className={fieldClass}
                >
                  {estadosMaterial.map((estado) => (
                    <option key={estado}>{estado}</option>
                  ))}
                </select>
              </label>

              <label className={`${labelClass} sm:col-span-2`}>
                Ubicación detallada
                <input
                  value={newMaterial.ubicacion_detallada}
                  onChange={(event) =>
                    setNewMaterial({
                      ...newMaterial,
                      ubicacion_detallada: event.target.value,
                    })
                  }
                  className={fieldClass}
                  placeholder="Ej: Huerta - estante superior"
                  required
                />
              </label>

              <label className={`${labelClass} sm:col-span-2`}>
                Notas
                <textarea
                  value={newMaterial.notas}
                  onChange={(event) =>
                    setNewMaterial({
                      ...newMaterial,
                      notas: event.target.value,
                    })
                  }
                  className={`${fieldClass} min-h-20`}
                  placeholder="Detalle opcional"
                />
              </label>

              <button
                type="submit"
                className="rounded-md bg-[#0072BC] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#005C96] sm:col-span-2"
              >
                Agregar material
              </button>
            </form>
          </div>

          <div className={panelClass}>
            <div className="border-b border-[#D7E7F6] px-5 py-4">
              <h2 className="text-lg font-semibold text-[#0072BC]">
                Registrar préstamo
              </h2>
            </div>
            <form onSubmit={handleAddLoan} className="flex flex-col gap-4 p-5">
              <label className={labelClass}>
                Material
                <select
                  value={newLoan.materialId}
                  onChange={(event) =>
                    setNewLoan({
                      ...newLoan,
                      materialId: event.target.value,
                      cantidad: 1,
                    })
                  }
                  className={fieldClass}
                >
                  {inventory.map((material) => (
                    <option key={material.id} value={material.id}>
                      {material.nombre} ({material.disponible} disp.)
                    </option>
                  ))}
                </select>
              </label>

              <label className={labelClass}>
                Cantidad
                <input
                  type="number"
                  min="1"
                  max={selectedMaterial?.disponible ?? 1}
                  value={newLoan.cantidad}
                  onChange={(event) =>
                    setNewLoan({
                      ...newLoan,
                      cantidad: Number(event.target.value),
                    })
                  }
                  className={fieldClass}
                  required
                />
              </label>

              <label className={labelClass}>
                Responsable
                <input
                  value={newLoan.responsable}
                  onChange={(event) =>
                    setNewLoan({
                      ...newLoan,
                      responsable: event.target.value,
                    })
                  }
                  className={fieldClass}
                  placeholder="Ej: madrijim, tzevet, nombre"
                  required
                />
              </label>

              <label className={labelClass}>
                Motivo
                <select
                  value={newLoan.motivo}
                  onChange={(event) =>
                    setNewLoan({ ...newLoan, motivo: event.target.value })
                  }
                  className={fieldClass}
                >
                  {motivos.map((motivo) => (
                    <option key={motivo}>{motivo}</option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className={labelClass}>
                  Fecha salida
                  <input
                    type="date"
                    value={newLoan.fecha_salida}
                    onChange={(event) =>
                      setNewLoan({
                        ...newLoan,
                        fecha_salida: event.target.value,
                      })
                    }
                    className={fieldClass}
                  />
                </label>

                <label className={labelClass}>
                  Devolución esperada
                  <input
                    type="date"
                    value={newLoan.fecha_devolucion_esperada}
                    onChange={(event) =>
                      setNewLoan({
                        ...newLoan,
                        fecha_devolucion_esperada: event.target.value,
                      })
                    }
                    className={fieldClass}
                  />
                </label>
              </div>

              <label className={labelClass}>
                Notas
                <textarea
                  value={newLoan.notas}
                  onChange={(event) =>
                    setNewLoan({ ...newLoan, notas: event.target.value })
                  }
                  className={`${fieldClass} min-h-20`}
                  placeholder="Detalle opcional"
                />
              </label>

              <button
                type="submit"
                disabled={!selectedMaterial || selectedMaterial.disponible < 1}
                className="rounded-md bg-[#F9A01B] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#D88912] disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                Registrar préstamo
              </button>
            </form>
          </div>
        </section>

        <section className="order-2 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className={panelClass}>
            <div className="flex flex-col gap-4 border-b border-[#D7E7F6] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-[#0072BC]">
                Inventario
              </h2>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className={`${fieldClass} w-full text-sm sm:max-w-xs`}
                placeholder="Buscar por nombre, categoría o ubicación"
              />
            </div>
            <div className="grid gap-3 p-4 md:hidden">
              {filteredInventory.map((item) => (
                <article
                  key={item.id}
                  className="rounded-lg border border-[#D7E7F6] bg-[#F8FBFE] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-zinc-900">
                        {item.nombre}
                      </h3>
                      <p className="mt-1 text-sm text-zinc-600">
                        {item.categoria}
                      </p>
                    </div>
                    <span className="rounded-md bg-white px-3 py-1 text-sm font-semibold text-[#0072BC]">
                      {item.disponible} disp.
                    </span>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-zinc-500">Total</dt>
                      <dd className="font-medium text-zinc-900">
                        {item.cantidad}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-zinc-500">Prestado</dt>
                      <dd className="font-medium text-zinc-900">
                        {item.prestada}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-zinc-500">Estado</dt>
                      <dd className="font-medium text-zinc-900">
                        {item.estado}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-zinc-500">Ubicación</dt>
                      <dd className="font-medium text-zinc-900">
                        {item.ubicacion_detallada}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead className="bg-[#EEF6FC] text-[#33566F]">
                  <tr>
                    <th className="px-5 py-3 font-medium">Material</th>
                    <th className="px-5 py-3 font-medium">Categoría</th>
                    <th className="px-5 py-3 font-medium">Ubicación</th>
                    <th className="px-5 py-3 font-medium">Estado</th>
                    <th className="px-5 py-3 font-medium">Total</th>
                    <th className="px-5 py-3 font-medium">Prestado</th>
                    <th className="px-5 py-3 font-medium">Disponible</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredInventory.map((item) => (
                    <tr key={item.id} className="hover:bg-[#F8FBFE]">
                      <td className="px-5 py-4 font-medium text-zinc-900">
                        {item.nombre}
                      </td>
                      <td className="px-5 py-4 text-zinc-600">
                        {item.categoria}
                      </td>
                      <td className="px-5 py-4 text-zinc-600">
                        {item.ubicacion_detallada}
                      </td>
                      <td className="px-5 py-4 text-zinc-600">
                        {item.estado}
                      </td>
                      <td className="px-5 py-4 text-zinc-600">
                        {item.cantidad}
                      </td>
                      <td className="px-5 py-4 text-zinc-600">
                        {item.prestada}
                      </td>
                      <td className="px-5 py-4 font-semibold text-[#0072BC]">
                        {item.disponible}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={panelClass}>
            <div className="border-b border-[#D7E7F6] px-5 py-4">
              <h2 className="text-lg font-semibold text-[#0072BC]">
                Préstamos activos
              </h2>
            </div>
            <div className="divide-y divide-zinc-100">
              {activeLoans.length === 0 ? (
                <p className="px-5 py-6 text-sm text-zinc-600">
                  No hay préstamos activos.
                </p>
              ) : (
                activeLoans.map((loan) => (
                  <div key={loan.id} className="flex flex-col gap-4 px-5 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div>
                        <p className="font-medium text-zinc-900">
                          {loan.material}
                        </p>
                        <p className="text-sm text-zinc-600">
                          {loan.cantidad} unidad(es) · {loan.responsable}
                        </p>
                        <p className="mt-1 text-sm text-zinc-500">
                          {loan.motivo} · Devuelve:{" "}
                          {loan.fecha_devolucion_esperada}
                        </p>
                      </div>
                      <span
                        className={
                          loan.estado === "Vencido"
                            ? "rounded-md bg-red-50 px-3 py-1 text-sm font-medium text-red-700"
                            : "rounded-md bg-[#FFF4DF] px-3 py-1 text-sm font-medium text-[#A66000]"
                        }
                      >
                        {loan.estado}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleReturnLoan(loan.id)}
                      className="w-full rounded-md border border-[#C9D8E6] px-3 py-2 text-sm font-semibold text-[#0072BC] transition hover:border-[#0072BC]/40 hover:bg-[#F5F8FB] sm:w-auto"
                    >
                      Registrar devolución
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
