// Persistent, resumable CODE task journal. No automatic shell or filesystem edits.
import {randomUUID,createHash} from 'node:crypto';
import {createStateStore} from '../memory/state-store.js';
const phases=['investigate','reason','propose','verify','review'];
const maxNotes=200;
function validId(id){return typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id);}
function copy(v){return structuredClone(v);}
export function createTaskJournal({file}={}){
 if(typeof file!=='string'||!file.trim())throw new TypeError('journal_file_required');
 const store=createStateStore({namespace:'journal-'+createHash('sha256').update(file).digest('hex').slice(0,40),file});
 let queue=Promise.resolve();
 async function load(){return store.read({version:1,tasks:[]}).tasks;}
 function transaction(fn){
  const result=queue.then(async()=>{
   const tasks=await load();
   const value=await fn(tasks);
   store.write({version:1,tasks});
   return copy(value);
  });
  queue=result.then(()=>{},()=>{});
  return result;
 }
 return {
  close(){store.close();},
  async create({instruction,project}){
   if(typeof instruction!=='string'||!instruction.trim()||instruction.length>4000||typeof project!=='string'||!project.trim())throw new TypeError('invalid_task');
   return transaction(tasks=>{
    if(tasks.length>=1000)throw new Error('journal_full');
    const now=new Date().toISOString();
    const task={id:randomUUID(),project,instruction,phase:'investigate',status:'active',notes:[],createdAt:now,updatedAt:now};
    tasks.push(task);return task;
   });
  },
  async get(id){if(!validId(id))throw new TypeError('invalid_task_id');return copy((await load()).find(t=>t.id===id)??null);},
  async list({project}={}){return copy((await load()).filter(t=>project===undefined||t.project===project));},
  async advance(id,{phase,note,evidence}={}){
   if(!validId(id))throw new TypeError('invalid_task_id');
   return transaction(tasks=>{
    const task=tasks.find(t=>t.id===id);if(!task)throw new Error('task_not_found');
    if(task.status!=='active')throw new Error('task_not_active');
    const current=phases.indexOf(task.phase),next=phases.indexOf(phase);
    if(next<0||next>current+1)throw new Error('invalid_phase_transition');
    if(typeof note!=='string'||!note.trim()||note.length>2000)throw new TypeError('task_note_required');
    if(task.notes.length>=maxNotes)throw new Error('task_notes_full');
    if(phase==='review'&&(!evidence||typeof evidence!=='object'||evidence.testsPassed!==true))throw new Error('test_evidence_required');
    task.phase=phase;task.notes.push({phase,note,evidence:evidence??null,at:new Date().toISOString()});
    task.updatedAt=new Date().toISOString();return task;
   });
  },
  async finish(id,{status,evidence}={}){
   if(!validId(id))throw new TypeError('invalid_task_id');
   if(!['completed','blocked'].includes(status))throw new TypeError('invalid_completion_status');
   return transaction(tasks=>{
    const task=tasks.find(t=>t.id===id);if(!task)throw new Error('task_not_found');
    if(task.status!=='active')throw new Error('task_not_active');
    if(status==='completed'&&(task.phase!=='review'||!evidence||evidence.testsPassed!==true||evidence.approved!==true))throw new Error('completion_evidence_required');
    if(status==='blocked'&&(!evidence||typeof evidence.reason!=='string'||!evidence.reason.trim()))throw new Error('block_reason_required');
    task.status=status;task.result=evidence;task.updatedAt=new Date().toISOString();return task;
   });
  }
 };
}
