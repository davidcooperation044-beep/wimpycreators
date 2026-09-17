import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "./lib/supabase";
import "./App.css";

type Creator = {
  id: string;
  ownerId: string;
  name: string;
  handle: string;
  category: string;
  followers: string;
  count: number;
  accent: string;
  avatar: string;
  cover: string;
  note: string;
  verified: boolean;
  createdAt: string;
};
type Route = {
  page:
    "home" | "dashboard" | "following" | "memberships" | "settings" | "creator";
  id?: string;
};
const categories = [
  "All creators",
  "Illustration",
  "Music",
  "Film & Photo",
  "Writing",
];
const accents = ["#ef806d", "#d8a54b", "#9d7cc8", "#82b8aa"];
const text = (value: unknown) => (typeof value === "string" ? value : "");
const signIn = () =>
  window.location.assign(
    `https://id.wimpy-corp.com.ng/login?redirect=${encodeURIComponent(window.location.href)}`,
  );
const parseRoute = (): Route => {
  const hash = location.hash.slice(1);
  if (hash === "/dashboard") return { page: "dashboard" };
  if (hash === "/following") return { page: "following" };
  if (hash === "/memberships") return { page: "memberships" };
  if (hash === "/settings") return { page: "settings" };
  if (hash.startsWith("/c/")) return { page: "creator", id: hash.slice(3) };
  return { page: "home" };
};
const formatMoney = (kobo: number) =>
  `₦${(kobo / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const formatFollowers = (count: number) =>
  count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);

declare global {
  interface Window {
    PaystackPop?: { setup: (options: { key: string; email: string; amount: number; ref: string; onClose: () => void; callback: (response: { reference: string }) => void }) => { openIframe: () => void } };
  }
}

function App() {
  const supabase = getSupabaseClient();
  const [user, setUser] = useState<User | null>(null);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [route, setRoute] = useState<Route>(parseRoute());
  const [dark, setDark] = useState(
    () => localStorage.getItem("wc-dark-mode") === "true",
  );
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [sort, setSort] = useState("trending");
  const [menu, setMenu] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [tip, setTip] = useState<Creator | null>(null);
  const [onboarding, setOnboarding] = useState(false);
  const [tipSent, setTipSent] = useState(false);
  const [tipError, setTipError] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = (path: string) => {
    location.hash = path;
    setRoute(parseRoute());
  };
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const client = supabase;
    async function bootstrap() {
      const queryParams = new URLSearchParams(location.search);
      const hashParams = new URLSearchParams(location.hash.replace(/^#/, ""));
      const access =
        queryParams.get("access_token") ?? hashParams.get("access_token");
      const refresh =
        queryParams.get("refresh_token") ?? hashParams.get("refresh_token");
      if (access && refresh) {
        const { error } = await client.auth.setSession({
          access_token: access,
          refresh_token: refresh,
        });
        if (error) console.error("WimpyID token handoff failed", error);
        const hadHashTokens =
          hashParams.has("access_token") || hashParams.has("refresh_token");
        history.replaceState(
          {},
          document.title,
          hadHashTokens
            ? location.pathname + location.search
            : location.pathname + location.hash,
        );
        setRoute(parseRoute());
      }
      setUser((await client.auth.getUser()).data.user ?? null);
    }
    bootstrap().finally(() => setLoading(false));
    const { data } = client.auth.onAuthStateChange((_event, session) =>
      setUser(session?.user ?? null),
    );
    const changed = () => setRoute(parseRoute());
    addEventListener("hashchange", changed);
    return () => {
      data.subscription.unsubscribe();
      removeEventListener("hashchange", changed);
    };
  }, [supabase]);
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    async function load() {
      const { data } = await client
        .from("wc_creators")
        .select(
          "id,user_id,stage_name,bio,avatar_url,banner_url,category,is_verified,created_at",
        )
        .order("created_at", { ascending: false });
      const ids = (data ?? []).map((row) => row.id);
      const { data: follows } = ids.length
        ? await client
            .from("wc_follows")
            .select("creator_id,follower_id")
            .in("creator_id", ids)
        : { data: [] as { creator_id: string; follower_id: string }[] };
      setCreators(
        (data ?? []).map((row, index) => {
          const count = (follows ?? []).filter(
            (item) => item.creator_id === row.id,
          ).length;
          const name = text(row.stage_name);
          return {
            id: row.id,
            ownerId: row.user_id,
            name,
            handle: `@${name.toLowerCase().replace(/[^a-z0-9]+/g, ".")}`,
            category: text(row.category) || "Creator",
            followers: formatFollowers(count),
            count,
            accent: accents[index % accents.length],
            avatar: text(row.avatar_url),
            cover: text(row.banner_url),
            note: text(row.bio),
            verified: Boolean(row.is_verified),
            createdAt: text(row.created_at),
          };
        }),
      );
      if (user)
        setFollowing(
          (
            (
              await client
                .from("wc_follows")
                .select("creator_id")
                .eq("follower_id", user.id)
            ).data ?? []
          ).map((item) => item.creator_id),
        );
    }
    load();
  }, [supabase, user]);
  const visible = useMemo(
    () =>
      creators
        .filter(
          (creator) =>
            (category === categories[0] || creator.category === category) &&
            `${creator.name} ${creator.handle} ${creator.note}`
              .toLowerCase()
              .includes(search.toLowerCase()),
        )
        .sort((a, b) =>
          sort === "recent"
            ? b.createdAt.localeCompare(a.createdAt)
            : b.count - a.count,
        ),
    [category, creators, search, sort],
  );
  const gate = (action: () => void) => (user ? action() : signIn());
  const toggleFollow = async (creator: Creator) => {
    if (!supabase || !user) return;
    const has = following.includes(creator.id);
    if (has)
      await supabase
        .from("wc_follows")
        .delete()
        .eq("creator_id", creator.id)
        .eq("follower_id", user.id);
    else
      await supabase
        .from("wc_follows")
        .insert({ creator_id: creator.id, follower_id: user.id });
    setFollowing((items) =>
      has ? items.filter((id) => id !== creator.id) : [...items, creator.id],
    );
  };
  const openTip = (creator: Creator) =>
    gate(() => {
      setTip(creator);
      setTipSent(false);
      setTipError("");
    });
  const toggleDark = () => {
    setDark((value) => {
      localStorage.setItem("wc-dark-mode", String(!value));
      return !value;
    });
  };
  if (loading)
    return (
      <div className="app-shell">
        <div className="empty-state">
          <span>✦</span>
          <h3>Setting the stage...</h3>
        </div>
      </div>
    );
  if (route.page === "creator" && route.id)
    return (
      <CreatorPage
        creator={creators.find((item) => item.id === route.id)}
        user={user}
        onBack={() => navigate("/")}
        onTip={openTip}
      />
    );
  if (route.page === "dashboard")
    return (
      <Dashboard
        user={user}
        creator={creators.find((item) => item.ownerId === user?.id)}
        onBack={() => navigate("/")}
      />
    );
  if (route.page === "following")
    return (
      <ListingPage
        title="Following"
        user={user}
        creators={creators.filter((item) => following.includes(item.id))}
        onBack={() => navigate("/")}
        onTip={openTip}
      />
    );
  if (route.page === "memberships")
    return (
      <Memberships
        user={user}
        creators={creators}
        onBack={() => navigate("/")}
      />
    );
  if (route.page === "settings")
    return (
      <Settings
        user={user}
        dark={dark}
        toggleDark={toggleDark}
        onBack={() => navigate("/")}
      />
    );
  return (
    <div className={`app-shell ${dark ? "dark" : ""}`}>
      <Sidebar
        user={user}
        following={following.length}
        creator={creators.find((item) => item.ownerId === user?.id)}
        navigate={navigate}
        onOnboard={() => gate(() => setOnboarding(true))}
        onMenu={() => setMenu((value) => !value)}
      />
      <main className="main-content">
        <Topbar
          user={user}
          creator={creators.find((item) => item.ownerId === user?.id)}
          search={search}
          setSearch={setSearch}
          dark={dark}
          toggleDark={toggleDark}
          navigate={navigate}
          menu={menu}
          setMenu={setMenu}
          notifications={notifications}
          setNotifications={setNotifications}
        />
        <div className="content-wrap">
          <section className="welcome-row">
            <div>
              <p className="eyebrow">THURSDAY, SEPTEMBER 17</p>
              <h1>Find your people.</h1>
              <p className="subheading">
                A little corner of the internet for the things worth making.
              </p>
            </div>
            <button
              className="outline-button"
              onClick={() => gate(() => setOnboarding(true))}
            >
              Share your work <span>↗</span>
            </button>
          </section>
          {creators[0] ? (
            <Spotlight
              creator={creators[0]}
              others={creators.slice(1, 3)}
              tip={openTip}
              scroll={() =>
                document
                  .querySelector(".browse-section")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            />
          ) : (
            <Empty
              title="The stage is waiting for its first creator"
              text="Sign in and become the first voice in the directory."
            />
          )}
          {
            <section className="browse-section">
              <div className="section-heading browse-heading">
                <div>
                  <span className="section-kicker">THE DIRECTORY</span>
                  <h2>Browse creators</h2>
                </div>
                <label className="sort-select">
                  Sort by{" "}
                  <select
                    value={sort}
                    onChange={(event) => setSort(event.target.value)}
                  >
                    <option value="trending">Trending now</option>
                    <option value="followers">Most followed</option>
                    <option value="recent">Recently joined</option>
                  </select>
                  ⌄
                </label>
              </div>
              <div className="category-tabs">
                {categories.map((item) => (
                  <button
                    key={item}
                    className={category === item ? "selected" : ""}
                    onClick={() => setCategory(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <div className="creator-grid">
                {visible.map((creator) => (
                  <CreatorCard
                    key={creator.id}
                    creator={creator}
                    following={following.includes(creator.id)}
                    onFollow={() => gate(() => toggleFollow(creator))}
                    onTip={() => openTip(creator)}
                    onOpen={() => navigate(`/c/${creator.id}`)}
                  />
                ))}
              </div>
              {!visible.length && (
                <Empty
                  title="No creators on this stage yet"
                  text="Try another search or category."
                />
              )}
            </section>
          }
        </div>
      </main>
      {tip && (
        <TipModal
          creator={tip}
          user={user}
          sent={tipSent}
          error={tipError}
          onClose={() => setTip(null)}
          onError={setTipError}
          onSent={() => setTipSent(true)}
        />
      )}
      {onboarding && user && (
        <Onboarding
          user={user}
          onClose={() => {
            setOnboarding(false);
            location.reload();
          }}
        />
      )}
    </div>
  );
}

function Sidebar({
  user,
  following,
  creator,
  navigate,
  onOnboard,
  onMenu,
}: {
  user: User | null;
  following: number;
  creator?: Creator;
  navigate: (path: string) => void;
  onOnboard: () => void;
  onMenu: () => void;
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">✦</span>
        <span>
          Wimpy<span className="brand-soft">Creators</span>
        </span>
      </div>
      <div className="profile-chip">
        <div className="profile-avatar">
          {user ? text(user.email).slice(0, 2).toUpperCase() : "?"}
        </div>
        <div>
          <strong>
            {user
              ? text(user.user_metadata?.full_name || user.email?.split("@")[0])
              : "Welcome backstage"}
          </strong>
          <span>
            {creator
              ? "Creator account"
              : user
                ? "Viewer account"
                : "Not signed in"}
          </span>
        </div>
        <button className="more-button" aria-label="Open account menu" onClick={onMenu}>
          •••
        </button>
      </div>
      <nav className="primary-nav">
        <button className="nav-item active" onClick={() => navigate("/")}>
          <span>⌂</span> Discover
        </button>
        <button
          className="nav-item"
          onClick={() => (user ? navigate("/following") : signIn())}
        >
          <span>♡</span> Following <b>{following}</b>
        </button>
        <button
          className="nav-item"
          onClick={() => (user ? navigate("/memberships") : signIn())}
        >
          <span>▱</span> My memberships
        </button>
      </nav>
      <div className="sidebar-bottom">
        <div className="creator-prompt">
          <span className="sparkle">✦</span>
          <strong>Have a story to tell?</strong>
          <p>Build your stage and let your people in.</p>
          <button onClick={onOnboard}>
            Become a creator <span>→</span>
          </button>
        </div>
        <button className="settings" onClick={() => navigate("/settings")}>
          <span>⚙</span> Settings
        </button>
        <p className="ecosystem">Part of the Wimpy Cooperations ecosystem</p>
      </div>
    </aside>
  );
}
function Topbar({
  user,
  creator,
  search,
  setSearch,
  dark,
  toggleDark,
  navigate,
  menu,
  setMenu,
  notifications,
  setNotifications,
}: {
  user: User | null;
  creator?: Creator;
  search: string;
  setSearch: (value: string) => void;
  dark: boolean;
  toggleDark: () => void;
  navigate: (path: string) => void;
  menu: boolean;
  setMenu: (value: boolean) => void;
  notifications: boolean;
  setNotifications: (value: boolean) => void;
}) {
  const supabase = getSupabaseClient();
  const [activity, setActivity] = useState<string[]>([]);
  useEffect(() => {
    if (!notifications || !creator || !supabase) return;
    Promise.all([
      supabase
        .from("wc_tips")
        .select("amount_kobo")
        .eq("creator_id", creator.id)
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("wc_subscriptions")
        .select("id")
        .eq("creator_id", creator.id)
        .eq("status", "active")
        .limit(3),
    ]).then(([tips, subscriptions]) =>
      setActivity([
        ...(tips.data ?? []).map(
          (tip) => `New tip: ${formatMoney(tip.amount_kobo)}`,
        ),
        ...(subscriptions.data ?? []).map(() => "New active subscriber"),
      ]),
    );
  }, [creator, notifications, supabase]);
  return (
    <header className="topbar">
      <div className="mobile-brand brand">
        <span className="brand-mark">✦</span>
        <span>
          Wimpy<span className="brand-soft">Creators</span>
        </span>
      </div>
      <label className="search-box">
        <span>⌕</span>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search creators, stories, or vibes"
        />
      </label>
      <div className="top-actions">
        {user ? (
          <button
            className="icon-button"
            aria-label="Open creator dashboard"
            onClick={() => navigate("/dashboard")}
          >
            ⌁
          </button>
        ) : (
          <button className="sign-in-button" onClick={signIn}>
            Sign in
          </button>
        )}
        <button
          className="icon-button"
          onClick={toggleDark}
          aria-label="Toggle theme"
        >
          {dark ? "☼" : "☾"}
        </button>
        <button
          className="notification"
          onClick={() => setNotifications(!notifications)}
          aria-label="Notifications"
        >
          ♧<i />
          {notifications && (
            <span className="dropdown">
              {activity.length
                ? activity.map((item) => <span key={item}>{item}</span>)
                : "No notifications yet"}
            </span>
          )}
        </button>
        <button className="tiny-profile" aria-label="Open account menu" onClick={() => setMenu(!menu)}>
          {user ? text(user.email).slice(0, 2).toUpperCase() : "?"}
        </button>
        {menu && (
          <span className="account-dropdown">
            <strong>{text(user?.email) || "Not signed in"}</strong>
            {user ? (
              <>
                <button onClick={() => navigate("/dashboard")}>
                  Creator dashboard
                </button>
                <button
                  onClick={() => {
                    supabase?.auth.signOut();
                    setMenu(false);
                  }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <button onClick={signIn}>Sign in with WimpyID</button>
            )}
          </span>
        )}
      </div>
    </header>
  );
}
function Spotlight({
  creator,
  others,
  tip,
  scroll,
}: {
  creator: Creator;
  others: Creator[];
  tip: (creator: Creator) => void;
  scroll: () => void;
}) {
  return (
    <section className="spotlight-section">
      <div className="section-heading">
        <div>
          <span className="section-kicker">ON THE STAGE</span>
          <h2>Creators in the spotlight</h2>
        </div>
        <button className="text-button" onClick={scroll}>
          See all <span>→</span>
        </button>
      </div>
      <div className="spotlight-grid">
        <article className="feature-card">
          <img src={creator.cover} alt={`${creator.name} banner`} />
          <div className="feature-overlay">
            <div className="featured-label">✦ FEATURED THIS WEEK</div>
            <h3>
              Make room for
              <br />
              <em>the magic.</em>
            </h3>
            <div className="feature-creator">
              <img src={creator.avatar} alt={creator.name} />
              <div>
                <strong>
                  {creator.name}{" "}
                  {creator.verified && <span className="verified">✦</span>}
                </strong>
                <span>
                  {creator.category} · {creator.followers} followers
                </span>
              </div>
              <button onClick={() => tip(creator)}>Tip</button>
            </div>
          </div>
        </article>
        <div className="side-stories">
          {others.map((item) => (
            <article className="story-card story-gold" key={item.id}>
              <div className="story-copy">
                <span className="story-label">CREATOR TO WATCH</span>
                <h3>
                  {item.name}
                  <br />
                  is on stage
                </h3>
                <span className="story-by">
                  {item.category} · {item.followers} followers
                </span>
              </div>
              <img src={item.avatar} alt={item.name} />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
function CreatorCard({
  creator,
  following,
  onFollow,
  onTip,
  onOpen,
}: {
  creator: Creator;
  following: boolean;
  onFollow: () => void;
  onTip: () => void;
  onOpen: () => void;
}) {
  return (
    <article className="creator-card">
      <div
        className="creator-cover"
        style={{ backgroundImage: `url(${creator.cover})` }}
        onClick={onOpen}
      >
        <button
          className="card-follow"
          onClick={(event) => {
            event.stopPropagation();
            onFollow();
          }}
        >
          {following ? "Following" : "+ Follow"}
        </button>
      </div>
      <div className="creator-card-body">
        <img
          className="creator-avatar"
          src={creator.avatar}
          alt={creator.name}
          onClick={onOpen}
        />
        <div className="creator-card-title">
          <div>
            <h3 onClick={onOpen}>
              {creator.name}{" "}
              {creator.verified && <span className="verified">✦</span>}
            </h3>
            <p>{creator.handle}</p>
          </div>
          <span className="follower-count">{creator.followers}</span>
        </div>
        <p className="creator-note">{creator.note}</p>
        <div className="card-footer">
          <span className="category-pill" style={{ color: creator.accent }}>
            {creator.category}
          </span>
          <button className="tip-link" onClick={onTip}>
            Send a tip <span>↗</span>
          </button>
        </div>
      </div>
    </article>
  );
}
function Empty({ title, text: description }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <span>✦</span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

function TipModal({
  creator,
  user,
  sent,
  error,
  onClose,
  onError,
  onSent,
}: {
  creator: Creator;
  user: User | null;
  sent: boolean;
  error: string;
  onClose: () => void;
  onError: (error: string) => void;
  onSent: () => void;
}) {
  const supabase = getSupabaseClient();
  const [amount, setAmount] = useState(2500);
  const [message, setMessage] = useState("");
  const [funding, setFunding] = useState(false);
  const submit = async () => {
    const session = await supabase?.auth.getSession();
    const response = await fetch("/api/tip", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${session?.data.session?.access_token ?? ""}`,
      },
      body: JSON.stringify({ creatorId: creator.id, amount, message }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) onError(result.error ?? "We could not send that tip.");
    else onSent();
  };
  return (
    <>
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal tip-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {sent ? (
          <div className="success-state">
            <span className="success-star">✦</span>
            <p className="eyebrow">TIP SENT</p>
            <h2>
              A little love,
              <br />
              <em>on its way.</em>
            </h2>
            <p>Your support means the world to {creator.name.split(" ")[0]}.</p>
            <button className="primary-button" onClick={onClose}>
              Back to discovery
            </button>
          </div>
        ) : (
          <>
            <button className="close-button" onClick={onClose}>
              ×
            </button>
            <p className="eyebrow">SUPPORT THE WORK</p>
            <h2>
              Send a little love
              <br />
              to <em>{creator.name}</em>
            </h2>
            <div className="tip-person">
              <img src={creator.avatar} alt="" />
              <span>{creator.handle}</span>
            </div>
            <div className="amount-options">
              {[1000, 2500, 5000].map((value) => (
                <button
                  className={amount === value ? "active" : ""}
                  key={value}
                  onClick={() => setAmount(value)}
                >
                  ₦{value.toLocaleString()}
                </button>
              ))}
              <label>
                ₦{" "}
                <input
                  placeholder="Custom amount"
                  inputMode="numeric"
                  onChange={(event) =>
                    setAmount(
                      Number(event.target.value.replace(/\D/g, "")) || 0,
                    )
                  }
                />
              </label>
            </div>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value.slice(0, 500))}
              placeholder="Add a note (optional)"
              rows={3}
            />
            {error && (
              <p className="inline-error">
                {error}{" "}
                <button onClick={() => setFunding(true)}>
                  Fund wallet
                </button>
              </p>
            )}
            <button className="primary-button" onClick={submit}>
              Continue to payment <span>→</span>
            </button>
            <p className="secure-note">Payments securely handled by WimpyPay</p>
          </>
        )}
      </div>
    </div>
    {funding && user && <FundWalletModal user={user} onClose={() => setFunding(false)} onFunded={async () => { setFunding(false); await submit() }} />}
    </>
  );
}

function FundWalletModal({ user, onClose, onFunded }: { user: User; onClose: () => void; onFunded: () => Promise<void> | void }) {
  const supabase = getSupabaseClient();
  const [amount, setAmount] = useState(10000);
  const [customAmount, setCustomAmount] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const amountKobo = customAmount ? Number(customAmount.replace(/\D/g, "")) * 100 : amount * 100;
  const loadPaystack = () => new Promise<void>((resolve, reject) => {
    if (window.PaystackPop) return resolve();
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://js.paystack.co/v1/inline.js"]');
    if (existing) { existing.addEventListener("load", () => resolve()); existing.addEventListener("error", () => reject(new Error("Could not load secure payment checkout."))); return; }
    const script = document.createElement("script"); script.src = "https://js.paystack.co/v1/inline.js"; script.onload = () => resolve(); script.onerror = () => reject(new Error("Could not load secure payment checkout.")); document.head.appendChild(script);
  });
  const startFunding = async () => {
    setError("");
    if (!Number.isInteger(amountKobo) || amountKobo < 10000) { setError("Enter at least ₦100."); return; }
    setLoading(true);
    try {
      const session = await supabase?.auth.getSession();
      const initiate = await fetch("/api/fund-wallet/initiate", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${session?.data.session?.access_token ?? ""}` }, body: JSON.stringify({ amount: amountKobo }) });
      const initiated = await initiate.json().catch(() => ({}));
      if (!initiate.ok) throw new Error(initiated.error ?? "Could not start wallet funding.");
      await loadPaystack();
      const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
      if (!publicKey || !window.PaystackPop) throw new Error("Wallet funding is not configured yet.");
      window.PaystackPop.setup({ key: publicKey, email: user.email ?? "", amount: amountKobo, ref: initiated.funding.reference, onClose: () => setLoading(false), callback: async ({ reference }) => {
        const sessionAfterPayment = await supabase?.auth.getSession();
        const verified = await fetch("/api/fund-wallet/verify", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${sessionAfterPayment?.data.session?.access_token ?? ""}` }, body: JSON.stringify({ reference }) });
        const result = await verified.json().catch(() => ({}));
        if (!verified.ok || result.status !== "confirmed") { setError(result.error ?? "Wallet funding could not be confirmed."); setLoading(false); return; }
        setConfirmed(true); setLoading(false); await onFunded();
      }}).openIframe();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not start wallet funding."); setLoading(false); }
  };
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal tip-modal" onMouseDown={(event) => event.stopPropagation()}>{confirmed ? <div className="success-state"><span className="success-star">✦</span><p className="eyebrow">WALLET FUNDED</p><h2>Your wallet is<br /><em>ready to go.</em></h2><p>Your payment was verified by WimpyPay. Retrying your action now.</p></div> : <><button className="close-button" onClick={onClose} aria-label="Close wallet funding">×</button><p className="eyebrow">WIMPYPAY WALLET</p><h2>Add a little<br /><em>room to your wallet.</em></h2><div className="amount-options">{[2000, 5000, 10000, 20000].map((value) => <button className={!customAmount && amount === value ? "active" : ""} key={value} onClick={() => { setAmount(value); setCustomAmount("") }}>₦{value.toLocaleString()}</button>)}<label>₦ <input value={customAmount} placeholder="Custom amount" inputMode="numeric" onChange={(event) => setCustomAmount(event.target.value.replace(/\D/g, ""))} /></label></div>{error && <p className="inline-error">{error}</p>}<button className="primary-button" disabled={loading} onClick={startFunding}>{loading ? "Opening secure checkout..." : "Fund wallet securely"} <span>→</span></button><p className="secure-note">Secure checkout handled by WimpyPay and Paystack</p></>}</div></div>;
}

function Onboarding({ user, onClose }: { user: User; onClose: () => void }) {
  const supabase = getSupabaseClient();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [category, setCategory] = useState("Illustration");
  const [avatar, setAvatar] = useState<File>();
  const [banner, setBanner] = useState<File>();
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    supabase.from("wc_creators").select("id,payout_recipient_code").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data && !data.payout_recipient_code) setStep(3);
    });
  }, [supabase, user.id]);
  const submit = async () => {
    if (!supabase) return;
    setSaving(true);
    const uploadedPaths: string[] = [];
    let createdProfile = false;
    try {
      const upload = async (file: File | undefined, type: string) => {
        if (!file) return null;
        const path = `${user.id}/${type}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "")}`;
        const result = await supabase.storage
          .from("creator-assets")
          .upload(path, file);
        if (result.error) throw result.error;
        uploadedPaths.push(path);
        return supabase.storage.from("creator-assets").getPublicUrl(path).data
          .publicUrl;
      };
      const avatarUrl = await upload(avatar, "avatar");
      const bannerUrl = await upload(banner, "banner");
      const { data: existing } = await supabase
        .from("wc_creators")
        .select("id,payout_recipient_code")
        .eq("user_id", user.id)
        .maybeSingle();
      let creatorId = existing?.id;
      if (!creatorId) {
        const { data, error: insertError } = await supabase
          .from("wc_creators")
          .insert({ user_id: user.id, stage_name: name.trim(), bio: bio.trim(), category, avatar_url: avatarUrl, banner_url: bannerUrl })
          .select("id")
          .single();
        if (insertError || !data) throw new Error(insertError?.message ?? "Could not create your profile.");
        creatorId = data.id;
        createdProfile = true;
      } else if (existing?.payout_recipient_code) {
        onClose();
        return;
      }
      const session = await supabase.auth.getSession();
      const response = await fetch("/api/register-payout-recipient", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.data.session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ bankCode, accountNumber, accountName }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(result.error ?? "Bank details could not be validated.");
      onClose();
    } catch (caught) {
      if (createdProfile) {
        await supabase.storage.from("creator-assets").remove(uploadedPaths);
        setError("Your profile was created but bank setup failed — retry bank setup.");
      } else {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not complete onboarding.",
      );
      }
      setSaving(false);
    }
  };
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal onboarding-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="close-button" onClick={onClose}>
          ×
        </button>
        <span className="onboarding-icon">✦</span>
        <p className="eyebrow">YOUR STAGE AWAITS · STEP {step} OF 3</p>
        {step === 1 && (
          <>
            <h2>
              Make a home
              <br />
              <em>for your work.</em>
            </h2>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Stage name"
            />
            <textarea
              value={bio}
              onChange={(event) => setBio(event.target.value.slice(0, 500))}
              placeholder="Tell people what you make"
              rows={4}
            />
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {categories.slice(1).map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <button
              className="primary-button"
              disabled={!name.trim()}
              onClick={() => setStep(2)}
            >
              Continue <span>→</span>
            </button>
          </>
        )}
        {step === 2 && (
          <>
            <h2>
              Bring your stage
              <br />
              <em>to life.</em>
            </h2>
            <label className="file-field">
              Avatar
              <input
                type="file"
                accept="image/*"
                onChange={(event) => setAvatar(event.target.files?.[0])}
              />
            </label>
            <label className="file-field">
              Banner
              <input
                type="file"
                accept="image/*"
                onChange={(event) => setBanner(event.target.files?.[0])}
              />
            </label>
            <button className="primary-button" onClick={() => setStep(3)}>
              Continue <span>→</span>
            </button>
          </>
        )}
        {step === 3 && (
          <>
            <h2>
              Where should we
              <br />
              <em>send your earnings?</em>
            </h2>
            <input
              value={accountName}
              onChange={(event) => setAccountName(event.target.value)}
              placeholder="Account name"
            />
            <input
              value={bankCode}
              onChange={(event) => setBankCode(event.target.value)}
              placeholder="Bank code"
              inputMode="numeric"
            />
            <input
              value={accountNumber}
              onChange={(event) => setAccountNumber(event.target.value)}
              placeholder="10-digit account number"
              inputMode="numeric"
            />
            {error && <p className="inline-error">{error}</p>}
            <button
              className="primary-button"
              disabled={saving}
              onClick={submit}
            >
              {saving ? "Setting up..." : "Create my stage"} <span>→</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function CreatorPage({
  creator,
  user,
  onBack,
  onTip,
}: {
  creator?: Creator;
  user: User | null;
  onBack: () => void;
  onTip: (creator: Creator) => void;
}) {
  const supabase = getSupabaseClient();
  const [tiers, setTiers] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [funding, setFunding] = useState(false);
  const [pendingTierId, setPendingTierId] = useState<string | null>(null);
  useEffect(() => {
    if (!supabase || !creator) return;
    Promise.all([
      supabase
        .from("wc_membership_tiers")
        .select("id,name,price_kobo,perks,is_active,creator_id")
        .eq("creator_id", creator.id)
        .eq("is_active", true)
        .order("price_kobo"),
      supabase
        .from("wc_posts")
        .select("id,title,content,media_url,visibility,created_at")
        .eq("creator_id", creator.id)
        .order("created_at", { ascending: false }),
    ]).then(([tierResult, postResult]) => {
      setTiers(tierResult.data ?? []);
      setPosts(postResult.data ?? []);
    });
  }, [supabase, creator]);
  if (!creator)
    return (
      <PageFrame onBack={onBack}>
        <Empty title="Creator not found" text="This stage may have moved." />
      </PageFrame>
    );
  const subscribe = async (tierId: string) => {
    if (!user) return signIn();
    const session = await supabase?.auth.getSession();
    const response = await fetch("/api/subscribe", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${session?.data.session?.access_token ?? ""}`,
      },
      body: JSON.stringify({ tierId }),
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok) setMessage("Membership activated.");
    else { setMessage(result.error ?? "Could not subscribe."); setPendingTierId(tierId); setFunding(true); }
  };
  return (
    <>
    <PageFrame onBack={onBack}>
      <div className="profile-hero">
        <img src={creator.cover} alt="" />
        <div>
          <img
            className="creator-avatar"
            src={creator.avatar}
            alt={creator.name}
          />
          <p className="eyebrow">{creator.category}</p>
          <h1>
            {creator.name}{" "}
            {creator.verified && <span className="verified">✦</span>}
          </h1>
          <p>{creator.note}</p>
        </div>
      </div>
      <div className="section-heading">
        <div>
          <span className="section-kicker">THE INNER CIRCLE</span>
          <h2>Membership tiers</h2>
        </div>
      </div>
      <div className="tier-grid">
        {tiers.map((tier) => (
          <article className="dashboard-stat" key={tier.id}>
            <h3>{tier.name}</h3>
            <strong>
              {formatMoney(tier.price_kobo)}
              <small>/ month</small>
            </strong>
            <p>{(tier.perks ?? []).join(" · ")}</p>
            <button
              className="primary-button"
              onClick={() => subscribe(tier.id)}
            >
              Subscribe
            </button>
          </article>
        ))}
      </div>
      {message && <p className="inline-error">{message}</p>}
      <div className="section-heading">
        <div>
          <span className="section-kicker">FROM THE STAGE</span>
          <h2>Posts</h2>
        </div>
        <button className="outline-button" onClick={() => onTip(creator)}>
          Send a tip
        </button>
      </div>
      {posts.length ? (
        posts.map((post) => (
          <article className="dashboard-panel post-card" key={post.id}>
            <h3>{text(post.title)}</h3>
            <p>{text(post.content)}</p>
            {post.media_url && <img src={post.media_url} alt="" />}
          </article>
        ))
      ) : (
        <Empty
          title="No public posts yet"
          text="Check back soon for something new."
        />
      )}
    </PageFrame>
    {funding && user && <FundWalletModal user={user} onClose={() => { setFunding(false); setPendingTierId(null) }} onFunded={async () => { const retryTierId = pendingTierId; setFunding(false); setPendingTierId(null); if (retryTierId) await subscribe(retryTierId) }} />}
    </>
  );
}
function PageFrame({
  children,
  onBack,
}: {
  children: React.ReactNode;
  onBack: () => void;
}) {
  return (
    <div className="app-shell">
      <main className="main-content">
        <header className="topbar">
          <button className="text-button" onClick={onBack}>
            ← Discover
          </button>
        </header>
        <div className="content-wrap">{children}</div>
      </main>
    </div>
  );
}

function ListingPage({
  title,
  user,
  creators,
  onBack,
  onTip,
}: {
  title: string;
  user: User | null;
  creators: Creator[];
  onBack: () => void;
  onTip: (creator: Creator) => void;
}) {
  return (
    <PageFrame onBack={onBack}>
      <p className="eyebrow">YOUR CORNER</p>
      <h1>{title}</h1>
      {user && creators.length ? (
        <div className="creator-grid">
          {creators.map((creator) => (
            <CreatorCard
              key={creator.id}
              creator={creator}
              following
              onFollow={() => undefined}
              onTip={() => onTip(creator)}
              onOpen={() => {
                location.hash = `/c/${creator.id}`;
              }}
            />
          ))}
        </div>
      ) : (
        <Empty
          title={
            user ? `No ${title.toLowerCase()} yet` : "Sign in to see this space"
          }
          text={
            user
              ? "Creators you connect with will appear here."
              : "Use WimpyID to continue."
          }
        />
      )}
    </PageFrame>
  );
}
function Memberships({
  user,
  creators,
  onBack,
}: {
  user: User | null;
  creators: Creator[];
  onBack: () => void;
}) {
  const supabase = getSupabaseClient();
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    if (user && supabase)
      supabase
        .from("wc_subscriptions")
        .select(
          "id,creator_id,status,renews_at,wc_creators(stage_name),wc_membership_tiers(name,price_kobo)",
        )
        .eq("subscriber_id", user.id)
        .eq("status", "active")
        .then(({ data }) => setItems(data ?? []));
  }, [user, supabase]);
  const cancel = async (id: string) => {
    await supabase
      ?.from("wc_subscriptions")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", id);
    setItems((current) => current.filter((item) => item.id !== id));
  };
  return (
    <PageFrame onBack={onBack}>
      <p className="eyebrow">YOUR INNER CIRCLE</p>
      <h1>My memberships</h1>
      {items.length ? (
        items.map((item) => (
          <article className="dashboard-panel membership-row" key={item.id}>
            <div>
              <h3>
                {item.wc_creators?.stage_name ??
                  creators.find((creator) => creator.id === item.creator_id)
                    ?.name}
              </h3>
              <p>
                {item.wc_membership_tiers?.name} ·{" "}
                {formatMoney(item.wc_membership_tiers?.price_kobo ?? 0)} ·
                renews {new Date(item.renews_at).toLocaleDateString()}
              </p>
            </div>
            <button className="outline-button" onClick={() => cancel(item.id)}>
              Cancel membership
            </button>
          </article>
        ))
      ) : (
        <Empty
          title="No active memberships"
          text="Support a creator and their work will appear here."
        />
      )}
    </PageFrame>
  );
}
function Settings({
  user,
  dark,
  toggleDark,
  onBack,
}: {
  user: User | null;
  dark: boolean;
  toggleDark: () => void;
  onBack: () => void;
}) {
  const supabase = getSupabaseClient();
  return (
    <PageFrame onBack={onBack}>
      <p className="eyebrow">YOUR SPACE</p>
      <h1>Settings</h1>
      <section className="dashboard-panel settings-panel">
        <button className="settings-row" onClick={toggleDark}>
          <span>Appearance</span>
          <strong>{dark ? "Dark mode" : "Light mode"}</strong>
        </button>
        {user && (
          <button
            className="settings-row"
            onClick={() => {
              supabase?.auth.signOut();
              onBack();
            }}
          >
            <span>Account</span>
            <strong>Sign out</strong>
          </button>
        )}
      </section>
    </PageFrame>
  );
}

function Dashboard({
  user,
  creator,
  onBack,
}: {
  user: User | null;
  creator?: Creator;
  onBack: () => void;
}) {
  const supabase = getSupabaseClient();
  const [stats, setStats] = useState({ balance: 0, subscribers: 0 });
  const [tips, setTips] = useState<any[]>([]);
  const [tiers, setTiers] = useState<any[]>([]);
  const [tierName, setTierName] = useState("");
  const [tierPrice, setTierPrice] = useState("");
  const [tierPerks, setTierPerks] = useState("");
  const [postTitle, setPostTitle] = useState("");
  const [postContent, setPostContent] = useState("");
  const [postMedia, setPostMedia] = useState<File>();
  const [postVisibility, setPostVisibility] = useState("public");
  const [payout, setPayout] = useState<any>();
  const [error, setError] = useState("");
  useEffect(() => {
    if (!creator || !supabase) return;
    Promise.all([
      supabase
        .from("wc_tips")
        .select("amount_kobo,message,sender_id,created_at")
        .eq("creator_id", creator.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("wc_subscriptions")
        .select("id")
        .eq("creator_id", creator.id)
        .eq("status", "active"),
      supabase
        .from("wc_subscription_charges")
        .select("amount_kobo")
        .eq("creator_id", creator.id),
      supabase
        .from("wc_payouts")
        .select("amount_kobo,status")
        .eq("creator_id", creator.id)
        .in("status", ["processing", "paid"]),
      supabase
        .from("wc_membership_tiers")
        .select("id,name,price_kobo,perks,is_active,creator_id")
        .eq("creator_id", creator.id)
        .order("price_kobo"),
    ]).then(
      ([
        tipResult,
        subscriberResult,
        chargeResult,
        payoutResult,
        tierResult,
      ]) => {
        const earned =
          (tipResult.data ?? []).reduce(
            (sum, item) => sum + item.amount_kobo,
            0,
          ) +
          (chargeResult.data ?? []).reduce(
            (sum, item) => sum + item.amount_kobo,
            0,
          );
        const withdrawn = (payoutResult.data ?? []).reduce(
          (sum, item) => sum + item.amount_kobo,
          0,
        );
        setStats({
          balance: earned - withdrawn,
          subscribers: subscriberResult.data?.length ?? 0,
        });
        setTips(tipResult.data ?? []);
        setTiers(tierResult.data ?? []);
      },
    );
  }, [creator, supabase]);
  useEffect(() => {
    if (!payout || !["pending", "processing"].includes(payout.status)) return;
    const poll = window.setInterval(async () => {
      const session = await supabase?.auth.getSession();
      const response = await fetch(`/api/payout-status/${payout.id}`, {
        headers: {
          authorization: `Bearer ${session?.data.session?.access_token ?? ""}`,
        },
      });
      if (response.ok) setPayout(await response.json());
    }, 4000);
    return () => clearInterval(poll);
  }, [payout, supabase]);
  if (!user)
    return (
      <PageFrame onBack={onBack}>
        <Empty
          title="Sign in to open the studio"
          text="Use WimpyID to continue."
        />
      </PageFrame>
    );
  if (!creator)
    return (
      <PageFrame onBack={onBack}>
        <Empty
          title="Create your stage to unlock the studio"
          text="Your creator profile will appear here after onboarding."
        />
      </PageFrame>
    );
  const requestPayout = async () => {
    const session = await supabase?.auth.getSession();
    const response = await fetch("/api/request-payout", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${session?.data.session?.access_token ?? ""}`,
      },
      body: JSON.stringify({ amount: stats.balance }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) setError(result.error ?? "Could not request payout.");
    else setPayout(result.payout);
  };
  const createTier = async () => {
    const price = Number(tierPrice);
    if (!tierName.trim() || !Number.isFinite(price) || price <= 0) {
      setError("Enter a tier name and a positive price.");
      return;
    }
    const { data, error: tierError } =
      (await supabase
        ?.from("wc_membership_tiers")
        .insert({
          creator_id: creator.id,
          name: tierName.trim(),
          price_kobo: price * 100,
          perks: tierPerks
            .split(",")
            .map((perk) => perk.trim())
            .filter(Boolean),
        })
        .select()
        .single()) ?? {};
    if (data) {
      setTiers((items) => [...items, data]);
      setTierName("");
      setTierPrice("");
      setTierPerks("");
    } else {
      setError(tierError?.message ?? "Could not create that tier. Check the fields and try again.");
    }
  };
  const addPost = async () => {
    let mediaUrl: string | null = null;
    if (postMedia) {
      const path = `${creator.ownerId}/post-${Date.now()}-${postMedia.name.replace(/[^a-zA-Z0-9._-]/g, "")}`;
      const upload = await supabase?.storage.from("creator-assets").upload(path, postMedia);
      if (upload?.error) { setError(upload.error.message); return; }
      mediaUrl = supabase?.storage.from("creator-assets").getPublicUrl(path).data.publicUrl ?? null;
    }
    const { data, error: postError } =
      (await supabase
        ?.from("wc_posts")
        .insert({
          creator_id: creator.id,
          title: postTitle.trim(),
          content: postContent.trim().slice(0, 5000),
          media_url: mediaUrl,
          visibility: postVisibility,
        })
        .select()
        .single()) ?? {};
    if (data) {
      setPostTitle("");
      setPostContent("");
      setPostMedia(undefined);
    } else {
      setError(postError?.message ?? "Could not publish that post. Check your connection and try again.");
    }
  };
  return (
    <PageFrame onBack={onBack}>
      <p className="eyebrow">CREATOR STUDIO</p>
      <h1>Welcome back, {creator.name}.</h1>
      <p className="subheading">Your stage, your people, your next move.</p>
      <div className="dashboard-grid">
        <div className="dashboard-stat">
          <span>AVAILABLE EARNINGS</span>
          <strong>{formatMoney(stats.balance)}</strong>
          <small>Tips and memberships</small>
        </div>
        <div className="dashboard-stat">
          <span>SUBSCRIBERS</span>
          <strong>{stats.subscribers}</strong>
          <small>Active members</small>
        </div>
        <div className="dashboard-stat">
          <span>FOLLOWERS</span>
          <strong>{creator.followers}</strong>
          <small>People following your stage</small>
        </div>
      </div>
      {error && <p className="inline-error">{error}</p>}
      <section className="dashboard-panel">
        <div className="section-heading">
          <div>
            <span className="section-kicker">PAYOUTS</span>
            <h2>Move earnings to your bank</h2>
          </div>
          <button
            className="primary-button dashboard-button"
            disabled={!stats.balance}
            onClick={requestPayout}
          >
            Request payout
          </button>
        </div>
        {payout && <p className="subheading">Payout status: {payout.status}</p>}
      </section>
      <section className="dashboard-panel">
        <div className="section-heading">
          <div>
            <span className="section-kicker">MEMBERSHIPS</span>
            <h2>Manage tiers</h2>
          </div>
        </div>
        <div className="tier-grid">
          {tiers.map((tier) => (
            <article className="dashboard-stat" key={tier.id}>
              <h3>{tier.name}</h3>
              <strong>{formatMoney(tier.price_kobo)}</strong>
              <p>{(tier.perks ?? []).join(" · ")}</p>
              <button
                className="outline-button"
                onClick={async () => {
                  await supabase
                    ?.from("wc_membership_tiers")
                    .update({ is_active: !tier.is_active })
                    .eq("id", tier.id);
                  setTiers((items) =>
                    items.map((item) =>
                      item.id === tier.id
                        ? { ...item, is_active: !item.is_active }
                        : item,
                    ),
                  );
                }}
              >
                {tier.is_active ? "Deactivate" : "Activate"}
              </button>
            </article>
          ))}
        </div>
        <div className="tier-form">
          <input
            value={tierName}
            onChange={(event) => setTierName(event.target.value)}
            placeholder="Tier name"
          />
          <input
            value={tierPrice}
            onChange={(event) => setTierPrice(event.target.value)}
            placeholder="Price in naira"
            inputMode="numeric"
          />
          <input
            value={tierPerks}
            onChange={(event) => setTierPerks(event.target.value)}
            placeholder="Perks, separated by commas"
          />
          <button className="primary-button" disabled={!tierName.trim() || !Number.isFinite(Number(tierPrice)) || Number(tierPrice) <= 0} onClick={createTier}>
            Create tier
          </button>
        </div>
      </section>
      <section className="dashboard-panel">
        <div className="section-heading">
          <div>
            <span className="section-kicker">PUBLISH</span>
            <h2>New post</h2>
          </div>
        </div>
        <input
          value={postTitle}
          onChange={(event) => setPostTitle(event.target.value)}
          placeholder="Post title"
        />
        <textarea
          value={postContent}
          onChange={(event) => setPostContent(event.target.value.slice(0, 5000))}
          placeholder="What do you want to share?"
          rows={4}
        />
        <input type="file" accept="image/*,video/*" onChange={(event) => setPostMedia(event.target.files?.[0])} />
        <select
          value={postVisibility}
          onChange={(event) => setPostVisibility(event.target.value)}
        >
          <option value="public">Public</option>
          {tiers
            .filter((tier) => tier.is_active)
            .map((tier) => (
              <option key={tier.id} value={`tier:${tier.id}`}>
                {tier.name} members
              </option>
            ))}
        </select>
        <button className="primary-button" onClick={addPost}>
          Publish post
        </button>
      </section>
      <section className="dashboard-panel">
        <div className="section-heading">
          <div>
            <span className="section-kicker">TIP HISTORY</span>
            <h2>Recent support</h2>
          </div>
        </div>
        {tips.length ? (
          tips.map((tip) => (
            <div className="tip-history" key={tip.created_at}>
              <strong>{formatMoney(tip.amount_kobo)}</strong>
              <span>{text(tip.message) || "Supporter"}</span>
            </div>
          ))
        ) : (
          <Empty
            title="No tips yet"
            text="Your supporters will show up here."
          />
        )}
      </section>
    </PageFrame>
  );
}

export default App;
