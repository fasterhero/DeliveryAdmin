
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
} from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { auth, db } from './firebase'

type Row = Record<string, unknown> & { id: string }
type Tab = 'orders' | 'merchants' | 'riders'

function text(value: unknown) {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

function money(value: unknown) {
  const amount = Number(value ?? 0)
  return Number.isFinite(amount)
    ? amount.toLocaleString('en-PH', {
        style: 'currency',
        currency: 'PHP',
      })
    : '—'
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<Tab>('orders')
  const [orders, setOrders] = useState<Row[]>([])
  const [merchants, setMerchants] = useState<Row[]>([])
  const [riders, setRiders] = useState<Row[]>([])
  const [dataError, setDataError] = useState('')

  useEffect(() => {
    return onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)
      setAuthorized(false)
      setChecking(true)
      setError('')

      if (!currentUser) {
        setChecking(false)
        return
      }

      try {
        const profile = await getDoc(
          doc(db, 'admins', currentUser.uid),
        )

        if (profile.exists() && profile.data().active === true) {
          setAuthorized(true)
        } else {
          setError(
            'This account is not an active administrator. Check admins/' +
              currentUser.uid,
          )
          await signOut(auth)
        }
      } catch (e) {
        setError(
          'Could not verify administrator access. Check Firestore rules and your Firebase configuration.',
        )
        await signOut(auth)
      } finally {
        setChecking(false)
      }
    })
  }, [])

  useEffect(() => {
    if (!user || !authorized) return

    setDataError('')

    const unsubOrders = onSnapshot(
      collection(db, 'orders'),
      (snapshot) => {
        const rows = snapshot.docs.map(
          (item) => ({ id: item.id, ...item.data() }) as Row,
        )
        rows.sort((a, b) => {
          const time = (value: unknown) => {
            if (value && typeof value === 'object' && 'seconds' in value) {
              return Number((value as { seconds: number }).seconds)
            }
            return 0
          }
          return time(b.createdAt) - time(a.createdAt)
        })
        setOrders(rows)
      },
      (e) => setDataError(`Orders: ${e.message}`),
    )

    const unsubMerchants = onSnapshot(
      collection(db, 'merchants'),
      (snapshot) => {
        setMerchants(
          snapshot.docs.map(
            (item) => ({ id: item.id, ...item.data() }) as Row,
          ),
        )
      },
      (e) => setDataError((old) => old || `Merchants: ${e.message}`),
    )

    const unsubRiders = onSnapshot(
      collection(db, 'riders'),
      (snapshot) => {
        setRiders(
          snapshot.docs.map(
            (item) => ({ id: item.id, ...item.data() }) as Row,
          ),
        )
      },
      (e) => setDataError((old) => old || `Riders: ${e.message}`),
    )

    return () => {
      unsubOrders()
      unsubMerchants()
      unsubRiders()
    }
  }, [user, authorized])

  async function login(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Unable to sign in.',
      )
    } finally {
      setBusy(false)
    }
  }

  if (checking) {
    return <main className="center-screen">Checking administrator access…</main>
  }

  if (!user || !authorized) {
    return (
      <main className="login-wrap">
        <form className="login-card" onSubmit={login}>
          <div className="brand-mark">DM</div>
          <p className="eyebrow">DELIVERY MARKETPLACE</p>
          <h1>Admin Portal</h1>
          <p className="muted">
            Sign in with your authorized administrator account.
          </p>

          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <p className="error">{error}</p>}

          <button className="primary-button" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
          <p className="small muted">
            Only approved administrator accounts can access this dashboard.
          </p>
        </form>
      </main>
    )
  }

  const delivered = orders.filter((o) => o.status === 'delivered').length
  const activeDeliveries = orders.filter(
    (o) => ['assigned', 'picked_up'].includes(String(o.status)),
  ).length
  const revenue = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + Number(o.total ?? 0), 0)

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">DELIVERY MARKETPLACE</p>
          <h1>Control Center</h1>
        </div>
        <button className="logout-button" onClick={() => signOut(auth)}>
          Log out
        </button>
      </header>

      <main className="dashboard">
        <p className="muted">Signed in as {user.email}</p>

        <section className="stats-grid">
          <Stat title="Total orders" value={orders.length} />
          <Stat title="Active deliveries" value={activeDeliveries} />
          <Stat title="Delivered" value={delivered} />
          <Stat title="Order totals*" value={money(revenue)} />
        </section>

        <p className="small muted">
          *Sum of non-cancelled order totals, not profit or confirmed payment.
        </p>

        <nav className="tabs">
          <TabButton active={tab === 'orders'} onClick={() => setTab('orders')}>
            Orders ({orders.length})
          </TabButton>
          <TabButton
            active={tab === 'merchants'}
            onClick={() => setTab('merchants')}
          >
            Merchants ({merchants.length})
          </TabButton>
          <TabButton active={tab === 'riders'} onClick={() => setTab('riders')}>
            Riders ({riders.length})
          </TabButton>
        </nav>

        {dataError && <p className="error">{dataError}</p>}

        {tab === 'orders' && (
          <section className="panel">
            <h2>Live Orders</h2>
            {orders.length === 0 ? (
              <p className="muted">No orders found.</p>
            ) : (
              orders.map((order) => (
                <article className="record" key={order.id}>
                  <div className="record-heading">
                    <strong>Order {order.id}</strong>
                    <span className={`status status-${text(order.status)}`}>
                      {text(order.status)}
                    </span>
                  </div>
                  <p>{text(order.merchantName)}</p>
                  <p>
                    Customer: {text(order.customerName)} ·{' '}
                    {text(order.customerPhone)}
                  </p>
                  <p>Address: {text(order.deliveryAddress)}</p>
                  <p>Rider UID: {text(order.riderId)}</p>
                  <strong>{money(order.total)}</strong>
                </article>
              ))
            )}
          </section>
        )}

        {tab === 'merchants' && (
          <section className="panel">
            <h2>Merchants</h2>
            {merchants.length === 0 && <p className="muted">No merchants found.</p>}
            {merchants.map((merchant) => (
              <article className="record" key={merchant.id}>
                <strong>{text(merchant.name)}</strong>
                <p>Document ID: {merchant.id}</p>
                <p>Status: {merchant.active === true ? 'Active' : 'Inactive'}</p>
                <p>{text(merchant.description)}</p>
              </article>
            ))}
          </section>
        )}

        {tab === 'riders' && (
          <section className="panel">
            <h2>Riders</h2>
            {riders.length === 0 && <p className="muted">No riders found.</p>}
            {riders.map((rider) => (
              <article className="record" key={rider.id}>
                <strong>{text(rider.name)}</strong>
                <p>Rider UID: {rider.id}</p>
                <p>Phone: {text(rider.phone)}</p>
                <p>Status: {rider.active === true ? 'Active' : 'Inactive'}</p>
              </article>
            ))}
          </section>
        )}
      </main>
      <footer className="footer">Delivery Marketplace · Admin</footer>
    </div>
  )
}

function Stat({ title, value }: { title: string; value: string | number }) {
  return (
    <article className="stat-card">
      <p>{title}</p>
      <strong>{value}</strong>
    </article>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      className={active ? 'tab active' : 'tab'}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  )
}

export default App
