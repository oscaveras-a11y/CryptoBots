import { randomUUID } from 'node:crypto';
import {createStateStore} from '../../agents/memory/state-store.js';

// In-process bounded scheduler. Jobs run concurrently, not in separate OS workers.
export class TaskQueue {
  #pending = [];
  #jobs = new Map();
  #active = 0;
  #limit;
  #maxPending;
  #maxCompleted;
  #completed=[];
  #store;
  constructor({ concurrency = 3, maxPending = 50, maxCompleted=100, durable=false, namespace='core-queue' } = {}) {
    if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) throw new TypeError('invalid_concurrency');
    if (!Number.isInteger(maxPending) || maxPending < 1 || maxPending > 1000) throw new TypeError('invalid_max_pending');
    this.#limit = concurrency;
    this.#maxPending = maxPending;
    if(!Number.isInteger(maxCompleted)||maxCompleted<1||maxCompleted>1000)throw new TypeError('invalid_max_completed');
    this.#maxCompleted=maxCompleted;
    if(durable){
      this.#store=createStateStore({namespace});
      const old=this.#store.read({version:1,jobs:[]});
      for(const entry of old.jobs??[]){
        const job={...entry,work:null};
        if(job.status==='queued'||job.status==='running'){
          job.status='interrupted';job.finishedAt=new Date().toISOString();
          job.error='restart_requires_explicit_resubmission';
        }
        this.#jobs.set(job.id,job);
        this.#completed.push(job.id);
      }
      this.#retainHistory();this.#persist();
    }
  }
  #persist(){if(this.#store)this.#store.write({version:1,jobs:[...this.#jobs.values()].map(({work,...job})=>job)});}
  #retainHistory(){while(this.#completed.length>this.#maxCompleted)this.#jobs.delete(this.#completed.shift());}
  close(){this.#store?.close();}
  get stats() { return { active: this.#active, pending: this.#pending.length, concurrency: this.#limit, capacity: this.#maxPending, availableSlots: Math.max(0,this.#limit-this.#active) }; }
  get(id) {
    const j = this.#jobs.get(id);
    return j ? { id: j.id, status: j.status, createdAt: j.createdAt, startedAt: j.startedAt, finishedAt: j.finishedAt, result: j.result, error: j.error } : null;
  }
  submit(work) {
    if (typeof work !== 'function') throw new TypeError('invalid_work');
    if (this.#pending.length >= this.#maxPending) throw new Error('task_queue_full');
    const job = { id: randomUUID(), status: 'queued', createdAt: new Date().toISOString(), startedAt: null, finishedAt: null, result: null, error: null, work };
    this.#jobs.set(job.id, job);
    this.#pending.push(job);
    this.#persist();
    this.#drain();
    return { id: job.id, status: job.status };
  }
  cancel(id) {
    const job = this.#jobs.get(id);
    if (!job || job.status !== 'queued') return false;
    this.#pending = this.#pending.filter(x => x.id !== id);
    job.status = 'cancelled';
    job.finishedAt = new Date().toISOString();
    job.work=null;this.#retain(job.id);this.#persist();
    return true;
  }
  #retain(id){this.#completed.push(id);while(this.#completed.length>this.#maxCompleted)this.#jobs.delete(this.#completed.shift());}
  #drain() {
    while (this.#active < this.#limit && this.#pending.length) {
      const job = this.#pending.shift();
      this.#active++;
      job.status = 'running';
      job.startedAt = new Date().toISOString();this.#persist();
      Promise.resolve().then(job.work).then(result => {
        job.result = result;
        job.status = 'completed';
      }, error => {
        job.error = error instanceof Error ? error.message : String(error);
        job.status = 'failed';
      }).finally(() => {
        job.finishedAt = new Date().toISOString();
        job.work=null;this.#retain(job.id);this.#persist();
        this.#active--;
        this.#drain();
      });
    }
  }
}
