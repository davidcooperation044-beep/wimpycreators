import { useMemo, useState } from 'react'
import './App.css'

type Creator = {
  name: string
  handle: string
  category: string
  followers: string
  accent: string
  avatar: string
  cover: string
  note: string
  verified?: boolean
}

const creators: Creator[] = [
  { name: 'Mina Okafor', handle: '@mina.makes', category: 'Illustration', followers: '12.4k', accent: '#ef806d', avatar: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=240&q=85', cover: 'https://images.unsplash.com/photo-1549490349-8643362247b5?auto=format&fit=crop&w=900&q=85', note: 'Tiny worlds, big feelings.', verified: true },
  { name: 'Tobi Adebayo', handle: '@tobi.tunes', category: 'Music', followers: '8.1k', accent: '#d8a54b', avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=240&q=85', cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=85', note: 'Late night songs for soft mornings.', verified: true },
  { name: 'Adaeze Nwosu', handle: '@adaeze.frames', category: 'Film & Photo', followers: '5.7k', accent: '#9d7cc8', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=240&q=85', cover: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=85', note: 'Documenting the beautiful in-between.' },
  { name: 'Kelechi Umeh', handle: '@kel.codes', category: 'Writing', followers: '3.2k', accent: '#82b8aa', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=240&q=85', cover: 'https://images.unsplash.com/photo-1456324504439-367cee3b3c32?auto=format&fit=crop&w=900&q=85', note: 'Notes on building a gentler internet.' },
]

const categories = ['All creators', 'Illustration', 'Music', 'Film & Photo', 'Writing']

function App() {
  const [activeCategory, setActiveCategory] = useState('All creators')
  const [search, setSearch] = useState('')
  const [darkMode, setDarkMode] = useState(false)
  const [following, setFollowing] = useState<string[]>([])
  const [tipCreator, setTipCreator] = useState<Creator | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [tipSent, setTipSent] = useState(false)

  const visibleCreators = useMemo(() => creators.filter((creator) => {
    const matchesCategory = activeCategory === 'All creators' || creator.category === activeCategory
    const query = search.toLowerCase()
    return matchesCategory && `${creator.name} ${creator.handle} ${creator.note}`.toLowerCase().includes(query)
  }), [activeCategory, search])

  const toggleFollow = (handle: string) => setFollowing((current) => current.includes(handle) ? current.filter((item) => item !== handle) : [...current, handle])
  const openTip = (creator: Creator) => { setTipCreator(creator); setTipSent(false) }

  return (
    <div className={`app-shell ${darkMode ? 'dark' : ''}`}>
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">✦</span><span>Wimpy<span className="brand-soft">Creators</span></span></div>
        <div className="profile-chip"><div className="profile-avatar">AM</div><div><strong>Amara M.</strong><span>Viewer account</span></div><button className="more-button" aria-label="Account menu">•••</button></div>
        <nav className="primary-nav" aria-label="Primary navigation"><button className="nav-item active"><span>⌂</span> Discover</button><button className="nav-item"><span>♡</span> Following <b>4</b></button><button className="nav-item"><span>▱</span> My memberships</button></nav>
        <div className="sidebar-bottom"><div className="creator-prompt"><span className="sparkle">✦</span><strong>Have a story to tell?</strong><p>Build your stage and let your people in.</p><button onClick={() => setShowOnboarding(true)}>Become a creator <span>→</span></button></div><button className="settings"><span>⚙</span> Settings</button><p className="ecosystem">Part of the Wimpy Cooperations ecosystem</p></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><div className="mobile-brand brand"><span className="brand-mark">✦</span><span>Wimpy<span className="brand-soft">Creators</span></span></div><label className="search-box"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search creators, stories, or vibes" /></label><div className="top-actions"><button className="icon-button" aria-label="Toggle theme" onClick={() => setDarkMode((mode) => !mode)}>{darkMode ? '☼' : '☾'}</button><button className="notification" aria-label="Notifications">♧<i /></button><button className="tiny-profile">AM</button></div></header>
        <div className="content-wrap">
          <section className="welcome-row"><div><p className="eyebrow">THURSDAY, SEPTEMBER 17</p><h1>Find your people.</h1><p className="subheading">A little corner of the internet for the things worth making.</p></div><button className="outline-button" onClick={() => setShowOnboarding(true)}>Share your work <span>↗</span></button></section>
          <section className="spotlight-section"><div className="section-heading"><div><span className="section-kicker">ON THE STAGE</span><h2>Creators in the spotlight</h2></div><button className="text-button">See all <span>→</span></button></div><div className="spotlight-grid"><article className="feature-card"><img src={creators[0].cover} alt="Abstract colorful artwork" /><div className="feature-overlay"><div className="featured-label">✦ FEATURED THIS WEEK</div><h3>Make room for<br /><em>the magic.</em></h3><div className="feature-creator"><img src={creators[0].avatar} alt="Mina Okafor" /><div><strong>{creators[0].name} <span className="verified">✦</span></strong><span>{creators[0].category} · {creators[0].followers} followers</span></div><button onClick={() => openTip(creators[0])}>Tip</button></div></div></article><div className="side-stories"><article className="story-card story-gold"><div className="story-copy"><span className="story-label">NEW DROP</span><h3>Notes from<br />a quiet room</h3><span className="story-by">by Tobi Tunes</span></div><img src={creators[1].avatar} alt="Tobi Adebayo" /></article><article className="story-card story-lilac"><div className="story-copy"><span className="story-label">CREATOR TO WATCH</span><h3>Frames that<br />feel like home</h3><span className="story-by">by Adaeze Frames</span></div><img src={creators[2].avatar} alt="Adaeze Nwosu" /></article></div></div></section>
          <section className="browse-section"><div className="section-heading browse-heading"><div><span className="section-kicker">THE DIRECTORY</span><h2>Browse creators</h2></div><label className="sort-select">Sort by <select><option>Trending now</option><option>Most followed</option><option>Recently joined</option></select>⌄</label></div><div className="category-tabs">{categories.map((category) => <button key={category} className={activeCategory === category ? 'selected' : ''} onClick={() => setActiveCategory(category)}>{category}</button>)}</div><div className="creator-grid">{visibleCreators.map((creator) => <article className="creator-card" key={creator.handle}><div className="creator-cover" style={{ backgroundImage: `url(${creator.cover})` }}><button className="card-follow" onClick={() => toggleFollow(creator.handle)}>{following.includes(creator.handle) ? 'Following' : '+ Follow'}</button></div><div className="creator-card-body"><img className="creator-avatar" src={creator.avatar} alt={creator.name} /><div className="creator-card-title"><div><h3>{creator.name} {creator.verified && <span className="verified">✦</span>}</h3><p>{creator.handle}</p></div><span className="follower-count">{creator.followers}</span></div><p className="creator-note">{creator.note}</p><div className="card-footer"><span className="category-pill" style={{ color: creator.accent }}>{creator.category}</span><button className="tip-link" onClick={() => openTip(creator)}>Send a tip <span>↗</span></button></div></div></article>)}</div>{visibleCreators.length === 0 && <div className="empty-state"><span>✦</span><h3>No creators on this stage yet</h3><p>Try another search or category.</p></div>}</section>
        </div>
      </main>

      {tipCreator && <div className="modal-backdrop" onMouseDown={() => setTipCreator(null)}><div className="modal tip-modal" onMouseDown={(event) => event.stopPropagation()}>{tipSent ? <div className="success-state"><span className="success-star">✦</span><p className="eyebrow">TIP SENT</p><h2>A little love,<br /><em>on its way.</em></h2><p>Your support means the world to {tipCreator.name.split(' ')[0]}.</p><button className="primary-button" onClick={() => setTipCreator(null)}>Back to discovery</button></div> : <><button className="close-button" onClick={() => setTipCreator(null)}>×</button><p className="eyebrow">SUPPORT THE WORK</p><h2>Send a little love<br />to <em>{tipCreator.name}</em></h2><div className="tip-person"><img src={tipCreator.avatar} alt="" /><span>{tipCreator.handle}</span></div><div className="amount-options"><button>₦1,000</button><button className="active">₦2,500</button><button>₦5,000</button><label>₦ <input placeholder="Custom amount" inputMode="numeric" /></label></div><textarea placeholder="Add a note (optional)" rows={3} /><button className="primary-button" onClick={() => setTipSent(true)}>Continue to payment <span>→</span></button><p className="secure-note">Payments securely handled by WimpyPay</p></>}</div></div>}
      {showOnboarding && <div className="modal-backdrop" onMouseDown={() => setShowOnboarding(false)}><div className="modal onboarding-modal" onMouseDown={(event) => event.stopPropagation()}><button className="close-button" onClick={() => setShowOnboarding(false)}>×</button><span className="onboarding-icon">✦</span><p className="eyebrow">YOUR STAGE AWAITS</p><h2>Make a home<br /><em>for your work.</em></h2><p>Set up your public page, gather your people, and get paid for the things only you can make.</p><input placeholder="What should we call you?" /><button className="primary-button" onClick={() => setShowOnboarding(false)}>Start your creator profile <span>→</span></button></div></div>}
    </div>
  )
}

export default App
