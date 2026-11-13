import { NavLink, Outlet } from 'react-router'

const NAV = [
  { to: '/import', label: 'Import' },
  { to: '/products', label: 'Products' },
  { to: '/imports', label: 'Import history' },
]

export default function Layout() {
  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-4 sm:px-6">
          <NavLink to="/" className="flex items-center gap-2 text-sm font-semibold text-stone-900">
            <span className="grid size-6 place-items-center rounded bg-stone-900 text-[11px] font-bold text-white">
              PI
            </span>
            Product Importer
          </NavLink>
          <nav className="flex gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/imports'}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm transition-colors ${
                    isActive ? 'bg-stone-100 font-medium text-stone-900' : 'text-stone-500 hover:text-stone-900'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
