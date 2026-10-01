'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {hashPassword}=require('../lib/auth');
async function password(prompt) {
  if(!process.stdin.isTTY)throw new Error('Execute o setup em um terminal interativo.');
  process.stdout.write(prompt);process.stdin.setRawMode(true);process.stdin.resume();
  return new Promise((resolve,reject)=>{let result='';function end(){process.stdin.setRawMode(false);process.stdin.pause();process.stdin.off('data',read);process.stdout.write('\n');}function read(chunk){for(const c of chunk.toString()){if(c==='\u0003'){end();return reject(new Error('Cancelado.'));}if(c==='\r'||c==='\n'){end();return resolve(result);}if(c==='\u007f'||c==='\b')result=result.slice(0,-1);else if(c>=' '&&result.length<200)result+=c;}}process.stdin.on('data',read);});
}
(async()=>{
 const p=await password('Crie a senha pessoal da VERIS (mínimo 12 caracteres; entrada oculta): ');
 if(p.length<12)throw new Error('Use pelo menos 12 caracteres.');
 if(p!==await password('Confirme a senha: '))throw new Error('Senhas diferentes.');
 const file=path.join(__dirname,'..','.env');
 if(fs.existsSync(file)&&fs.lstatSync(file).isSymbolicLink())throw new Error('Arquivo .env não pode ser link simbólico.');
 let content=fs.existsSync(file)?fs.readFileSync(file,'utf8'):fs.readFileSync(path.join(__dirname,'..','.env.example'),'utf8');
 const set=(key,value)=>{const pattern=new RegExp('^'+key+'=.*$','m');content=pattern.test(content)?content.replace(pattern,key+'='+value):content+'\n'+key+'='+value+'\n';};
 set('VERIS_PASSWORD_HASH',hashPassword(p));
 if(!/^VERIS_OWNER_API_KEY=.{32,}$/m.test(content))set('VERIS_OWNER_API_KEY',crypto.randomBytes(32).toString('hex'));
 fs.writeFileSync(file,content,{mode:0o600});fs.chmodSync(file,0o600);
 console.log('Acesso configurado. Execute npm start e entre com sua senha. Credenciais não foram exibidas.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
