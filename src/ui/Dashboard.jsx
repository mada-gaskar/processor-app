import { useEffect, useState } from 'react'
import { useOutletContext, Link } from 'react-router-dom'

export default function Dashboard(){
  const { db, setDb, storage, currentUser } = useOutletContext()
  const [title, setTitle] = useState('')

  function progressOf(proc){
    const steps = (currentUser.steps||[]).filter(s=>s.processId===proc.id)
    const done = steps.filter(s=>s.done).length
    return steps.length? Math.round((done/steps.length)*100):0
  }

  async function addProcess(){
    if(!title.trim()) return
    const id = crypto.randomUUID()
    const nextUsers = db.users.map(u=> u.id===db.currentUserId ? { ...u, processes:[...(u.processes||[]), {id,title}] } : u)
    const next = { ...db, users: nextUsers }
    await storage.save(next); setDb(next); setTitle('')
  }

  return (
    <div>
      <h2>Dashboard</h2>
      <div className="row">
        <input className="input" placeholder="New process title" value={title} onChange={e=>setTitle(e.target.value)} />
        <button className="button primary" onClick={addProcess}>Add</button>
      </div>
      <div className="grid" style={{marginTop:16}}>
        {(currentUser.processes||[]).map(p=> (
          <Link key={p.id} to={`/process/${p.id}`} className="card" style={{textDecoration:'none',color:'inherit'}}>
            <div style={{fontWeight:700}}>{p.title}</div>
            <div className="progress"><span style={{width:progressOf(p)+'%'}}/></div>
            <div className="small">{progressOf(p)}% complete</div>
          </Link>
        ))}
        {(currentUser.processes||[]).length===0 && <div className="card small">No processes yet.</div>}
      </div>
    </div>
  )
}