import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import './styles.css'

function migrateIfNeeded(d){
  if (!d) return null
  // Legacy shape -> migrate to multi-user
  const isLegacy = d.profile && Array.isArray(d.processes) && Array.isArray(d.steps)
  if (isLegacy){
    const userId = 'user-1'
    return {
      currentUserId: userId,
      users: [{ id:userId, name:d.profile.name||'Me', role:d.profile.role||'User', avatar:d.profile.avatar||'', processes:d.processes||[], steps:d.steps||[] }],
      theme: d.theme || 'light'
    }
  }
  // Already new shape
  if (!d.users) {
    return {
      currentUserId: 'user-1',
      users: [{ id:'user-1', name:'Me', role:'User', avatar:'', processes:[], steps:[] }],
      theme: d.theme || 'light'
    }
  }
  return d
}

const storage = {
  async load() {
    if (window.api?.db){
      const raw = await window.api.db.get()
      const migrated = migrateIfNeeded(raw)
      if (JSON.stringify(migrated)!==JSON.stringify(raw)){
        await this.save(migrated)
      }
      return migrated
    }
    // Browser preview fallback using localStorage
    const rawStr = localStorage.getItem('db')
    const raw = rawStr? JSON.parse(rawStr): null
    const migrated = migrateIfNeeded(raw || { profile:{name:'Me', role:'User', avatar:''}, processes:[], steps:[], theme:'light' })
    localStorage.setItem('db', JSON.stringify(migrated))
    return migrated
  },
  async save(db) {
    if (window.api?.db) return await window.api.db.set(db)
    localStorage.setItem('db', JSON.stringify(db))
  },
  async backup() {
    if (window.api?.db) return await window.api.db.backup()
    const db = await this.load()
    return { fileName: 'popo2-backup.json', content: JSON.stringify(db, null, 2) }
  }
}

export default function RootLayout(){
  const [db, setDb] = useState(null)
  const [theme, setTheme] = useState('light')
  const nav = useNavigate()

  const currentUser = useMemo(()=> db? db.users.find(u=>u.id===db.currentUserId) : null, [db])

  useEffect(()=>{(async()=>{
    let d = await storage.load();
    // Ensure currentUserId points to an existing user after restore/migration
    if (d && Array.isArray(d.users) && d.users.length > 0 && !d.users.find(u=>u.id===d.currentUserId)) {
      d = { ...d, currentUserId: d.users[0].id };
      await storage.save(d);
    }
    setDb(d); setTheme(d.theme || 'light');
    document.documentElement.dataset.theme = d.theme || 'light'
  })()},[])

  async function handleBackup(){
    const b = await storage.backup()
    const blob = new Blob([b.content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download=b.fileName; a.click(); URL.revokeObjectURL(url)
  }

  // Merge helper used by upload
  function mergeUsers(baseUsers, incomingUsers){
    const byId = new Map(baseUsers.map(u=>[u.id, {...u}]))
    for(const u of (incomingUsers||[])){
      if(!byId.has(u.id)) { byId.set(u.id, {...u}); continue }
      const cur = byId.get(u.id)
      const procMap = new Map((cur.processes||[]).map(p=>[p.id,p]))
      for(const p of (u.processes||[])) procMap.set(p.id, { ...procMap.get(p.id), ...p })
      const stepMap = new Map((cur.steps||[]).map(s=>[s.id,s]))
      for(const s of (u.steps||[])) stepMap.set(s.id, { ...stepMap.get(s.id), ...s })
      byId.set(u.id, { ...cur, ...u, processes:[...procMap.values()], steps:[...stepMap.values()] })
    }
    return [...byId.values()]
  }

  // New: Upload and merge backup (no prompts)
  async function handleUploadMerge(){
    // Electron path
    if (window.api?.db?.restore){
      const res = await window.api.db.restore()
      if (!res) return
      if (res.success && res.data && Array.isArray(res.data.users)){
        const mergedUsers = mergeUsers(db.users, res.data.users)
        const preferredId = res.data.currentUserId && mergedUsers.find(u=>u.id===res.data.currentUserId) ? res.data.currentUserId : (db.currentUserId && mergedUsers.find(u=>u.id===db.currentUserId) ? db.currentUserId : (mergedUsers[0]?.id))
        const merged = { ...db, ...res.data, users: mergedUsers, currentUserId: preferredId }
        await storage.save(merged); setDb(merged)
        const nextTheme = merged.theme || 'light'
        document.documentElement.dataset.theme = nextTheme
        setTheme(nextTheme)
        return
      }
      alert(res?.error || 'Failed to restore backup.')
      return
    }
    // Browser fallback path
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const raw = JSON.parse(text)
        const data = migrateIfNeeded(raw) || raw
        if (!data.users || !Array.isArray(data.users)) throw new Error('Invalid backup format')
        const mergedUsers = mergeUsers(db.users, data.users)
        const preferredId = data.currentUserId && mergedUsers.find(u=>u.id===data.currentUserId) ? data.currentUserId : (db.currentUserId && mergedUsers.find(u=>u.id===db.currentUserId) ? db.currentUserId : (mergedUsers[0]?.id))
        const merged = { ...db, ...data, users: mergedUsers, currentUserId: preferredId }
        await storage.save(merged); setDb(merged)
        const nextTheme = merged.theme || 'light'
        document.documentElement.dataset.theme = nextTheme
        setTheme(nextTheme)
      } catch (e){
        alert('Invalid or unreadable backup file.')
      }
    }
    input.click()
  }

  async function toggleTheme(){
    const next = theme === 'dark' ? 'light' : 'dark'
    if (window.api?.theme) await window.api.theme.set(next)
    document.documentElement.dataset.theme = next
    const nextDb = { ...db, theme: next }
    await storage.save(nextDb)
    setDb(nextDb)
    setTheme(next)
  }

  async function switchUser(id){
    if (!db || db.currentUserId===id) return
    const next = { ...db, currentUserId:id }
    await storage.save(next); setDb(next)
  }

  if(!db || !currentUser) return <div className="center">Loading…</div>

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">PROCESSOR</div>
        <div className="profile" style={{gap:12}}>
          {currentUser.avatar && currentUser.avatar.startsWith('data:')
            ? <img src={currentUser.avatar} alt="avatar" style={{width:40,height:40,borderRadius:'50%'}} />
            : <div className="avatar">{currentUser.name?.[0]||'U'}</div>}
          <div style={{flex:1}}>
            <div className="name">{currentUser.name}</div>
            <div className="role">{currentUser.role}</div>
          </div>
        </div>
        <div className="row">
          <select className="input" value={db.currentUserId} onChange={e=>switchUser(e.target.value)}>
            {db.users.map(u=> <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <nav>
          <NavLink end to="/">Dashboard</NavLink>
        </nav>
        <div className="spacer" />
        <button className="toggle" onClick={toggleTheme}>
          Dark Mode <span className={`dot ${theme==='dark'?'on':''}`}></span>
        </button>
        {/* New upload button above download */}
        <button className="secondary" onClick={handleUploadMerge}>Upload/Merge Backup</button>
        <button className="secondary" onClick={handleBackup}>Download Backup</button>
      </aside>
      <main className="content"><Outlet context={{db,setDb,storage,nav,currentUser}}/></main>
    </div>
  )
}