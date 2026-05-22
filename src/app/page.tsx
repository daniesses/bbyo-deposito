const sections = [
  {
    title: "Inventario",
    description: "Consultar materiales, cantidades disponibles y estado.",
    stat: "128 items",
  },
  {
    title: "Registrar salida",
    description: "Anotar prestamos de materiales para actividades.",
    stat: "Nuevo prestamo",
  },
  {
    title: "Registrar devolucion",
    description: "Marcar materiales que vuelven al deposito.",
    stat: "Pendientes",
  },
  {
    title: "Prestamos activos",
    description: "Ver quienes tienen materiales y fechas de devolucion.",
    stat: "7 activos",
  },
  {
    title: "Cargar Excel",
    description: "Preparar importacion de inventario desde planillas.",
    stat: "Mock",
  },
];

const inventory = [
  { name: "Parlante portatil", category: "Audio", available: 3, borrowed: 1 },
  { name: "Alargue 10m", category: "Electricidad", available: 8, borrowed: 2 },
  { name: "Pelotas", category: "Recreacion", available: 14, borrowed: 0 },
];

const activeLoans = [
  { item: "Proyector", responsible: "Madrijim", dueDate: "24/05" },
  { item: "Microfono", responsible: "Tzevet eventos", dueDate: "26/05" },
  { item: "Banderas", responsible: "Ken centro", dueDate: "28/05" },
];

export default function Home() {
  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-3 border-b border-zinc-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
              BBYO Deposito
            </h1>
            <p className="mt-2 text-base text-zinc-600 sm:text-lg">
              Inventario y prestamos de materiales
            </p>
          </div>
          <div className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600 shadow-sm">
            Datos mockeados para MVP
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {sections.map((section) => (
            <a
              key={section.title}
              href="#"
              className="group flex min-h-40 flex-col justify-between rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
            >
              <div>
                <h2 className="text-base font-semibold text-zinc-950">
                  {section.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {section.description}
                </p>
              </div>
              <span className="mt-4 text-sm font-medium text-emerald-700">
                {section.stat}
              </span>
            </a>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-zinc-950">
                Inventario destacado
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-zinc-50 text-zinc-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Material</th>
                    <th className="px-5 py-3 font-medium">Categoria</th>
                    <th className="px-5 py-3 font-medium">Disponible</th>
                    <th className="px-5 py-3 font-medium">Prestado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {inventory.map((item) => (
                    <tr key={item.name}>
                      <td className="px-5 py-4 font-medium text-zinc-900">
                        {item.name}
                      </td>
                      <td className="px-5 py-4 text-zinc-600">
                        {item.category}
                      </td>
                      <td className="px-5 py-4 text-zinc-600">
                        {item.available}
                      </td>
                      <td className="px-5 py-4 text-zinc-600">
                        {item.borrowed}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-zinc-950">
                Prestamos activos
              </h2>
            </div>
            <div className="divide-y divide-zinc-100">
              {activeLoans.map((loan) => (
                <div
                  key={`${loan.item}-${loan.responsible}`}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                >
                  <div>
                    <p className="font-medium text-zinc-900">{loan.item}</p>
                    <p className="text-sm text-zinc-600">{loan.responsible}</p>
                  </div>
                  <span className="rounded-md bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">
                    {loan.dueDate}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
