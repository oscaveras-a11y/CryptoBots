'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
function empty() { return {version:2,products:[],campaigns:[],ledger:[],contacts:[],tasks:[],reports:[],conversations:[],memory:[],usage:[],audit:[]}; }
class Store {
  constructor(file = process.env.VERIS_DATA_FILE || path.join(__dirname,'..','data','business.json')) {
    this.file = path.resolve(file);
    const directory = path.dirname(this.file);
    fs.mkdirSync(directory,{recursive:true,mode:0o700});
    // The default data folder can safely be restricted. Custom folders may be
    // shared paths (for example a user-selected mounted volume), so leave their
    // directory ACLs alone while still protecting the database file itself.
    const privateDirectory = path.resolve(__dirname,'..','data');
    if(directory===privateDirectory)fs.chmodSync(directory,0o700);
    this.lock = this.file+'.lock';
    // Atomic directory creation serializes readers and writers. Keeping the
    // directory until the final rmdir avoids an unlink/recreate race.
    fs.mkdirSync(this.lock,{mode:0o700});
    try {
      this.lockFd=fs.openSync(path.join(this.lock,'pid'),'wx',0o600);
      fs.writeFileSync(this.lockFd,String(process.pid));
      let existing=false;
      try {
        const details=fs.lstatSync(this.file);
        if(!details.isFile())throw new Error('O arquivo do banco precisa ser um arquivo regular, sem links simbólicos.');
        fs.chmodSync(this.file,0o600);
        existing=true;
      } catch(e) {if(e.code!=='ENOENT')throw e;}
      this.state=existing?JSON.parse(fs.readFileSync(this.file,'utf8')):empty();
      if(this.state.version!==2)throw new Error('Versão do banco incompatível; preserve o arquivo e migre antes de iniciar.');
      for(const key of Object.keys(empty()))if(Array.isArray(empty()[key])&&!Array.isArray(this.state[key]))throw new Error('Banco inválido: '+key);
    } catch(e) {
      if(this.lockFd!==undefined){fs.closeSync(this.lockFd);this.lockFd=undefined;}
      fs.rmSync(this.lock,{recursive:true,force:true});
      throw e;
    }
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
  close() {if(this.lockFd!==undefined){fs.closeSync(this.lockFd);fs.unlinkSync(path.join(this.lock,'pid'));fs.rmdirSync(this.lock);this.lockFd=undefined;}}
}
module.exports = {Store};
