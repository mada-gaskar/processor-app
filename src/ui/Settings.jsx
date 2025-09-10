import { useOutletContext } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'

function mergeUsers(baseUsers, incomingUsers){
  const byId = new Map(baseUsers.map(u=>[u.id, {...u}]))
  for(const u of incomingUsers){
    if(!byId.has(u.id)) { byId.set(u.id, {...u}); continue }
    const cur = byId.get(u.id)
    // merge arrays by id
    const procMap = new Map((cur.processes||[]).map(p=>[p.id,p]))
    for(const p of (u.processes||[])) procMap.set(p.id, { ...procMap.get(p.id), ...p })
    const stepMap = new Map((cur.steps||[]).map(s=>[s.id,s]))
    for(const s of (u.steps||[])) stepMap.set(s.id, { ...stepMap.get(s.id), ...s })
    byId.set(u.id, { ...cur, ...u, processes:[...procMap.values()], steps:[...stepMap.values()] })
  }
  return [...byId.values()]
}

export default function Settings(){
  const { db, setDb, storage, currentUser } = useOutletContext()
  const [name, setName] = useState(currentUser.name)
  const [role, setRole] = useState(currentUser.role)
  const avatarPreview = useMemo(()=> currentUser.avatar || '', [currentUser.avatar])

  // Keep form fields in sync with the active profile
  useEffect(()=>{
    setName(currentUser.name || '')
    setRole(currentUser.role || '')
  }, [currentUser.id])

  async function save(){
    const nextUsers = db.users.map(u=> u.id===db.currentUserId? { ...u, name, role } : u)
    const next = { ...db, users: nextUsers }
    await storage.save(next); setDb(next)
  }

  async function switchProfile(id){
    if (id===db.currentUserId) return
    const next = { ...db, currentUserId: id }
    await storage.save(next); setDb(next)
  }

  async function addProfile(){
    const newName = window.prompt('New profile name?','User')
    if (!newName) return
    const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `user-${Date.now()}`
    const newUser = { id, name:newName, role:'User', avatar:'', processes:[], steps:[] }
    // Append but keep the current active profile unchanged
    const next = { ...db, users:[...db.users, newUser] }
    await storage.save(next); setDb(next)
  }

  async function addProfilesBulk(){
    const input = window.prompt('Enter profile names (comma or newline separated)')
    if (!input) return
    const parts = input.split(/[\n,]/).map(s=>s.trim()).filter(Boolean)
    if (parts.length===0) return
    const now = Date.now()
    const newUsers = parts.map((n, idx) => ({
      id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `user-${now}-${idx}`,
      name: n,
      role: 'User',
      avatar: '',
      processes: [],
      steps: []
    }))
    const next = { ...db, users:[...db.users, ...newUsers] }
    await storage.save(next); setDb(next)
  }

  async function renameProfile(userId){
    const u = db.users.find(x=>x.id===userId)
    if (!u) return
    const newName = window.prompt('Rename profile', u.name)
    if (!newName) return
    const next = { ...db, users: db.users.map(x=> x.id===userId? { ...x, name:newName } : x) }
    await storage.save(next); setDb(next)
    if (userId===db.currentUserId) setName(newName)
  }

  async function deleteProfile(userId){
    if (db.users.length<=1){ alert('At least one profile is required.'); return }
    const u = db.users.find(x=>x.id===userId)
    if (!u) return
    if (!window.confirm(`Delete profile "${u.name}" and all its data? This cannot be undone.`)) return
    const remaining = db.users.filter(x=>x.id!==userId)
    const nextCurrent = db.currentUserId===userId? remaining[0].id : db.currentUserId
    const next = { ...db, users: remaining, currentUserId: nextCurrent }
    await storage.save(next); setDb(next)
  }

  async function downloadBackup(){
    const b = await storage.backup()
    const blob = new Blob([b.content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download=b.fileName; a.click(); URL.revokeObjectURL(url)
  }

  async function downloadCurrentProfileBackup(){
    const u = db.users.find(x=>x.id===db.currentUserId)
    const payload = { currentUserId: u.id, users:[u], theme: db.theme }
    const blob = new Blob([JSON.stringify(payload,null,2)], { type:'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download=`profile-${u.name||'user'}.json`; a.click(); URL.revokeObjectURL(url)
  }

  async function restoreBackup(){
    if (!window.api?.db?.restore){ alert('Restore is only available in the desktop app.'); return }
    const res = await window.api.db.restore()
    if (!res) return
    if (res.success && res.data){
      const mode = window.prompt('Restore mode: type "override" to replace current data, or "merge" to merge (default: merge).','merge')
      if ((mode||'').toLowerCase()==='override'){
        // Ensure currentUserId is valid in incoming data
        let incoming = res.data
        const hasCurrent = incoming.users.find(u=>u.id===incoming.currentUserId)
        if (!hasCurrent && incoming.users.length>0){
          incoming = { ...incoming, currentUserId: incoming.users[0].id }
        }
        await storage.save(incoming); setDb(incoming)
      } else {
        const mergedUsers = mergeUsers(db.users, res.data.users)
        // Choose a valid current user id
        const preferredId = res.data.currentUserId && mergedUsers.find(u=>u.id===res.data.currentUserId) ? res.data.currentUserId : (db.currentUserId && mergedUsers.find(u=>u.id===db.currentUserId) ? db.currentUserId : (mergedUsers[0]?.id))
        const merged = { ...db, ...res.data, users: mergedUsers, currentUserId: preferredId }
        await storage.save(merged); setDb(merged)
      }
      return
    }
    alert(res.error || 'Failed to restore backup.')
  }

  async function restoreIntoCurrentProfile(){
    if (!window.api?.db?.restore){ alert('Restore is only available in the desktop app.'); return }
    const res = await window.api.db.restore()
    if (!res) return
    if (res.success && res.data){
      const backup = res.data
      const incoming = (backup.users && backup.users.find(u=>u.id===db.currentUserId)) || (backup.users && backup.users[0])
      if (!incoming){ alert('Backup has no users.'); return }
      const mode = window.prompt('Restore into current profile: type "override" to replace this profile, or "merge" to merge (default: merge).','merge')
      let nextUsers
      if ((mode||'').toLowerCase()==='override'){
        const replaced = { ...incoming, id: db.currentUserId }
        nextUsers = db.users.map(u=> u.id===db.currentUserId? replaced : u)
      } else {
        const uCur = db.users.find(u=>u.id===db.currentUserId)
        // merge processes and steps only for current user
        const procMap = new Map((uCur.processes||[]).map(p=>[p.id,p]))
        for(const p of (incoming.processes||[])) procMap.set(p.id, { ...procMap.get(p.id), ...p })
        const stepMap = new Map((uCur.steps||[]).map(s=>[s.id,s]))
        for(const s of (incoming.steps||[])) stepMap.set(s.id, { ...stepMap.get(s.id), ...s })
        const mergedUser = { ...uCur, ...incoming, id: db.currentUserId, processes:[...procMap.values()], steps:[...stepMap.values()] }
        nextUsers = db.users.map(u=> u.id===db.currentUserId? mergedUser : u)
      }
      const next = { ...db, users: nextUsers }
      await storage.save(next); setDb(next)
      return
    }
    alert(res.error || 'Failed to restore backup.')
  }

  async function uploadAvatar(){
    if (!window.api?.image){ alert('Avatar upload is only available in the desktop app.'); return }
    const fileName = await window.api.image.upload()
    if (!fileName) return
    const dataUrl = await window.api.image.get(fileName)
    if (!dataUrl) return
    const nextUsers = db.users.map(u=> u.id===db.currentUserId? { ...u, avatar: dataUrl } : u)
    const next = { ...db, users: nextUsers }
    await storage.save(next); setDb(next)
  }

  return (
    <div>
      <h2>Settings</h2>

      <h3 style={{marginTop:12}}>Active Profile</h3>
      <div className="row" style={{maxWidth:520, gap:8, alignItems:'center'}}>
        <select data-testid="active-profile-select" className="input" value={db.currentUserId} onChange={e=>switchProfile(e.target.value)}>
          {db.users.map(u=> <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <button data-testid="add-profile" className="button" onClick={addProfile}>Add Profile</button>
        <button data-testid="add-profiles-bulk" className="button" onClick={addProfilesBulk}>Add Multiple</button>
      </div>

      <div className="row" style={{maxWidth:520, marginTop:12, gap:12, alignItems:'center'}}>
        {avatarPreview? <img src={avatarPreview} alt="avatar" style={{width:56,height:56,borderRadius:'50%'}}/> : <div className="avatar" style={{width:56,height:56}}>{name?.[0]||'U'}</div>}
        <button className="button" onClick={uploadAvatar}>Upload Avatar</button>
      </div>

      <div className="row" style={{maxWidth:520, marginTop:12}}>
        <input className="input" placeholder="Name" value={name} onChange={e=>setName(e.target.value)} />
        <input className="input" placeholder="Role" value={role} onChange={e=>setRole(e.target.value)} />
        <button className="button primary" onClick={save}>Save</button>
      </div>

      <h3 style={{marginTop:24}}>Manage Profiles</h3>
      <div className="list" style={{maxWidth:600}}>
        {db.users.map(u=> (
          <div key={u.id} className="item" style={{alignItems:'center', ...(db.currentUserId===u.id?{boxShadow:'0 0 0 2px var(--color-accent, #4f46e5) inset', borderRadius:8}:{})}}>
            <div className="title" style={{display:'flex',alignItems:'center',gap:8, fontWeight: db.currentUserId===u.id? '600':'500'}}>
              {u.avatar? <img src={u.avatar} alt="avatar" style={{width:32,height:32,borderRadius:'50%'}}/> : <div className="avatar" style={{width:32,height:32}}>{u.name?.[0]||'U'}</div>}
              <div>{u.name}</div>
              {db.currentUserId===u.id && <span className="tag" style={{marginLeft:6, fontSize:12, padding:'2px 6px', borderRadius:8, background:'var(--bg-muted, #eef2ff)', color:'var(--color-accent, #4f46e5)'}}>Active</span>}
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="button" onClick={()=>switchProfile(u.id)} disabled={db.currentUserId===u.id}>Switch</button>
              <button className="button" onClick={()=>renameProfile(u.id)}>Rename</button>
              <button className="button" onClick={()=>deleteProfile(u.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      <h3 style={{marginTop:24}}>Backup</h3>
      <div className="row" style={{gap:8, flexWrap:'wrap'}}>
        <button className="button" onClick={downloadBackup}>Download All Profiles</button>
        <button className="button" onClick={downloadCurrentProfileBackup}>Download Current Profile</button>
        <button className="button" onClick={restoreBackup}>Upload/Restore All</button>
        <button className="button" onClick={restoreIntoCurrentProfile}>Upload/Restore into Current Profile</button>
      </div>
    </div>
  )
}