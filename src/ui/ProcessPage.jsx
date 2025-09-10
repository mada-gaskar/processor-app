import { useParams, useOutletContext } from 'react-router-dom'
import { useMemo, useState } from 'react'

export default function ProcessPage(){
  const { id } = useParams()
  const { db, setDb, storage, currentUser } = useOutletContext()
  const process = (currentUser.processes||[]).find(p=>p.id===id)
  const [text, setText] = useState('')
  const [dragIndex, setDragIndex] = useState(null)

  const steps = useMemo(()=> (currentUser.steps||[]).filter(s=>s.processId===id), [db,id,currentUser])

  if(!process) return <div>Process not found.</div>

  async function addStep(){
    if(!text.trim()) return
    const nextUsers = db.users.map(u=> u.id===db.currentUserId ? { ...u, steps:[...(u.steps||[]), { id: crypto.randomUUID(), processId:id, title:text, done:false, scheduledAt: null }] } : u)
    const next = { ...db, users: nextUsers }
    await storage.save(next); setDb(next); setText('')
  }

  async function toggleStep(s){
    const nextUsers = db.users.map(u=> u.id===db.currentUserId ? { ...u, steps: (u.steps||[]).map(x=> x.id===s.id? { ...x, done:!x.done } : x) } : u)
    const next = { ...db, users: nextUsers }
    await storage.save(next); setDb(next)
  }

  async function removeStep(s){
    const nextUsers = db.users.map(u=> u.id===db.currentUserId ? { ...u, steps: (u.steps||[]).filter(x=>x.id!==s.id) } : u)
    const next = { ...db, users: nextUsers }
    await storage.save(next); setDb(next)
  }

  async function scheduleStep(s, when){
    const nextUsers = db.users.map(u=> u.id===db.currentUserId ? { ...u, steps: (u.steps||[]).map(x=> x.id===s.id? { ...x, scheduledAt: when } : x) } : u)
    const next = { ...db, users: nextUsers }
    await storage.save(next); setDb(next)
  }

  async function renameProcess(newTitle){
    const nextUsers = db.users.map(u=> u.id===db.currentUserId ? { ...u, processes: (u.processes||[]).map(p=> p.id===id? { ...p, title:newTitle} : p) } : u)
    const next = { ...db, users: nextUsers }
    await storage.save(next); setDb(next)
  }

  function handleDragStart(i){
    setDragIndex(i)
  }
  function handleDragOver(e){
    e.preventDefault()
  }
  async function handleDrop(targetIndex){
    if(dragIndex===null) return
    if(dragIndex===targetIndex){ setDragIndex(null); return }
    const within = [...steps]
    const [moved] = within.splice(dragIndex,1)
    within.splice(targetIndex,0,moved)
    let p = 0
    const nextUsers = db.users.map(u=> u.id===db.currentUserId ? ({
      ...u,
      steps: (u.steps||[]).map(x => x.processId===id ? within[p++] : x)
    }) : u)
    const next = { ...db, users: nextUsers }
    await storage.save(next); setDb(next)
    setDragIndex(null)
  }

  return (
    <div>
      <div className="row" style={{alignItems:'center'}}>
        <input className="input" style={{fontSize:22,fontWeight:700}} value={process.title} onChange={e=>renameProcess(e.target.value)} />
      </div>

      <div className="row" style={{marginTop:16}}>
        <input className="input" placeholder="New step" value={text} onChange={e=>setText(e.target.value)} />
        <button className="button primary" onClick={addStep}>Add step</button>
      </div>

      <div className="list" style={{marginTop:16}}>
        {steps.map((s,i)=> (
          <div key={s.id} className="item" onDragOver={handleDragOver} onDrop={()=>handleDrop(i)}>
            <span className="drag-handle" draggable onDragStart={()=>handleDragStart(i)} title="Drag to reorder" aria-label="Drag to reorder">⋮⋮</span>
            <input type="checkbox" checked={s.done} onChange={()=>toggleStep(s)} />
            <div className="title">{s.title}</div>
            <input className="input" type="datetime-local" value={s.scheduledAt||''} onChange={e=>scheduleStep(s, e.target.value)} />
            <button className="button" onClick={()=>removeStep(s)}>Delete</button>
          </div>
        ))}
        {steps.length===0 && <div className="small">No steps yet.</div>}
      </div>
    </div>
  )
}