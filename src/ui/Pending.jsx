import { useMemo, useState } from 'react'
import { useOutletContext, Link } from 'react-router-dom'

export default function Pending(){
  const { db, setDb, storage, currentUser } = useOutletContext()
  const [title, setTitle] = useState('')
  const [when, setWhen] = useState('')
  const [processId, setProcessId] = useState((currentUser.processes||[])[0]?.id || '')

  const pending = useMemo(()=> (currentUser.steps||[]).filter(s=>!s.done && s.scheduledAt), [db,currentUser])

  async function addScheduled(){
    if(!title.trim() || !when || !processId) return
    const nextUsers = db.users.map(u=> u.id===db.currentUserId ? { ...u, steps:[...(u.steps||[]), { id: crypto.randomUUID(), processId, title, done:false, scheduledAt: when }] } : u)
    const next = { ...db, users: nextUsers }
    await storage.save(next); setDb(next); setTitle(''); setWhen('')
  }

  async function markDone(step){
    const nextUsers = db.users.map(u=> u.id===db.currentUserId ? { ...u, steps: (u.steps||[]).map(s=> s.id===step.id? { ...s, done:true } : s) } : u)
    const next = { ...db, users: nextUsers }
    await storage.save(next); setDb(next)
  }

  async function remove(step){
    const nextUsers = db.users.map(u=> u.id===db.currentUserId ? { ...u, steps: (u.steps||[]).filter(s=> s.id!==step.id) } : u)
    const next = { ...db, users: nextUsers }
    await storage.save(next); setDb(next)
  }

  return (
    <div>
      <h2>Pending (Scheduled Steps)</h2>

      <div className="row" style={{marginTop:12, gap:8}}>
        <select className="input" value={processId} onChange={e=>setProcessId(e.target.value)}>
          {(currentUser.processes||[]).map(p=> <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        <input className="input" placeholder="New scheduled step" value={title} onChange={e=>setTitle(e.target.value)} />
        <input className="input" type="datetime-local" value={when} onChange={e=>setWhen(e.target.value)} />
        <button className="button primary" onClick={addScheduled}>Add</button>
      </div>

      <div className="list" style={{marginTop:16}}>
        {pending.map(s=> {
          const proc = (currentUser.processes||[]).find(p=>p.id===s.processId)
          return (
            <div key={s.id} className="item">
              <div className="title">
                <div>{s.title}</div>
                <div className="small">{new Date(s.scheduledAt).toLocaleString()} · in <Link to={`/process/${proc?.id}`}>{proc?.title||'Unknown'}</Link></div>
              </div>
              <button className="button" onClick={()=>markDone(s)}>Mark done</button>
              <button className="button" onClick={()=>remove(s)}>Delete</button>
            </div>
          )
        })}
        {pending.length===0 && <div className="small">No scheduled steps.</div>}
      </div>
    </div>
  )
}