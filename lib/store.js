'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
function empty() { return {version:2,products:[],campaigns:[],ledger:[],contacts:[],tasks:[],reports:[],conversations:[],memory:[],usage:[],audit:[]}; }
class Store {
  constructor(file = process.env.VERIS_DATA_FILE || path.join(__dirname,'..','data','business.json')) {
    this.file = file;
    this.state = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file,'utf8')) : empty();
    if(this.state.version !== 2) throw new Error('Versão do banco incompatível; preserve o arquivo e migre antes de iniciar.');
    for(const key of Object.keys(empty())) if(Array.isArray(empty()[key]) && !Array.isArray(this.state[key])) throw new Error('Banco inválido: '+key);
    this.lock = file+'.lock';
    fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
    // Um processo por banco. Não remover locks automaticamente: evita dois escritores.
    this.lockFd = fs.openSync(this.lock,'wx',0o600);
    fs.writeFileSync(this.lockFd,String(process.pid));
  }
  read() { return structuredClone(this.state); }
  change(fn, action) {
    const next = this.read();
    const result = fn(next);
    if(action) next.audit.push({id:crypto.randomUUID(),action,at:new Date().toISOString()});
    next.audit = next.audit.slice(-2000);
    const temp = this.file+'.'+crypto.randomUUID()+'.tmp';
    const fd = fs.openSync(temp,'wx',0o600);
    try { fs.writeFileSync(fd,JSON.stringify(next,null,2)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    try { fs.renameSync(temp,this.file); } catch(e) {fs.rmSync(temp,{force:true});throw e;}
    this.state = next;
    return structuredClone(result);
  }
  close() {if(this.lockFd!==undefined){fs.closeSync(this.lockFd);fs.unlinkSync(this.lock);this.lockFd=undefined;}}
}
module.exports = {Store};
