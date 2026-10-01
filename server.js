'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {Store}=require('./lib/store'),{Auth}=require('./lib/auth'),{Providers}=require('./lib/providers'),{Business,parseCSV,error}=require('./lib/business');
function isLoopback(host) {return host==='localhost'||host==='127.0.0.1'||host==='::1'||host==='::ffff:127.0.0.1';}
function validateBinding(host,env=process.env) {if(env.VERIS_PUBLIC_TLS_TERMINATED==='true'&&env.NODE_ENV!=='production')throw new Error('Proxy TLS só pode ser habilitado em NODE_ENV=production.');if(!isLoopback(host)&&!(env.NODE_ENV==='production'&&env.VERIS_PUBLIC_TLS_TERMINATED==='true'))throw new Error('Bind público bloqueado: mantenha HOST em loopback ou configure explicitamente um proxy TLS confiável.');}
function createApp({env=process.env,store,fetcher=global.fetch}={}) {
  store=store||new Store(env.VERIS_DATA_FILE||path.join(__dirname,'data','business.json'));
  const auth=new Auth(env),providers=new Providers(store,{env,fetcher}),business=new Business(store,providers);
  let timer=null;
  function json(res,status,data,headers={}) {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(data));}
  async function body(req) {let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>128*1024)throw error('Corpo excede 128 KB.',413);chunks.push(chunk);}let v;try{v=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw error('JSON inválido.',400);}if(!v||typeof v!=='object'||Array.isArray(v))throw error('Objeto JSON obrigatório.',400);return v;}
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    if(env.NODE_ENV==='production')res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
    if(env.VERIS_PUBLIC_TLS_TERMINATED==='true'&&(!isLoopback(req.socket.remoteAddress)||req.headers['x-forwarded-proto']!=='https'))return json(res,426,{error:'Acesso externo exige o proxy HTTPS confiável.'});
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    try {
      const u=new URL(req.url,'http://localhost'),route=u.pathname,write=!['GET','HEAD'].includes(req.method);
      if(req.method==='GET'&&route==='/health')return json(res,200,{ok:true,service:'VERIS-AI',version:'2.0.0'});
      if(req.method==='GET'&&['/','/app.js','/media.js','/style.css'].includes(route)) {const file=route==='/'?'index.html':route.slice(1);res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8','Cache-Control':'no-store'});return res.end(fs.readFileSync(path.join(__dirname,'public',file)));}
      if((route.startsWith('/api/')||route==='/v1/chat')&&route!=='/api/login'&&auth.limited(req,'api',120))return json(res,429,{error:'Limite temporário excedido.'});
      if(route==='/api/login'&&req.method==='POST') {
        if(!auth.sameOrigin(req))return json(res,403,{error:'Origem não permitida.'});
        if(auth.limited(req,'login',5))return json(res,429,{error:'Aguarde um minuto antes de tentar novamente.'});
        const data=await body(req),session=auth.login(data.password);
        if(!session)return json(res,401,{error:'Senha inválida ou acesso ainda não configurado.'});
        return json(res,200,{ok:true,csrf:session.csrf},{'Set-Cookie':auth.cookie(session.token)});
      }
      if(!route.startsWith('/api/')&&route!=='/v1/chat')return json(res,404,{error:'Rota não encontrada.'});
      if(!auth.authorized(req,write))return json(res,auth.session(req)?403:401,{error:auth.session(req)?'Sessão ou proteção CSRF inválida.':'Faça login com o acesso do proprietário.'});
      if(route==='/api/session'&&req.method==='GET')return json(res,200,{authenticated:true,csrf:auth.session(req)?.csrf||null});
      if(route==='/api/logout'&&req.method==='POST'){auth.logout(req);return json(res,200,{ok:true},{'Set-Cookie':auth.cookie('',true)});}
      if(route==='/api/state'&&req.method==='GET')return json(res,200,business.snapshot());
      if(route==='/api/export'&&req.method==='GET')return json(res,200,store.read(),{'Content-Disposition':'attachment; filename="veris-backup.json"'});
      if(route==='/api/import'&&req.method==='POST') {const d=await body(req);return json(res,201,{products:business.importProducts(d.csv!==undefined?parseCSV(d.csv):d.products)});}
      if((route==='/api/chat'||route==='/v1/chat')&&req.method==='POST')return json(res,200,await business.chat(await body(req)));
      if(route==='/api/products'&&req.method==='POST')return json(res,201,business.addProduct(await body(req)));
      if(route==='/api/ledger'&&req.method==='POST')return json(res,201,business.addLedger(await body(req)));
      if(route==='/api/contacts'&&req.method==='POST')return json(res,201,business.addContact(await body(req)));
      if(route==='/api/memory'&&req.method==='POST')return json(res,201,business.remember(await body(req)));
      if(route==='/api/campaigns'&&req.method==='POST')return json(res,201,await business.createCampaign(await body(req)));
      if(route==='/api/reports'&&req.method==='POST')return json(res,201,business.report());
      if(route==='/api/tasks'&&req.method==='POST')return json(res,201,business.addTask(await body(req)));
      if(route==='/api/workflows'&&req.method==='POST')return json(res,201,await business.workflow(await body(req)));
      const match=route.match(/^\/api\/(products|ledger|contacts|memory|campaigns|tasks|conversations)\/([a-f0-9-]{36})(?:\/(approve|published|run|export))?$/);
      if(match){const [,key,id,action]=match;
        if(req.method==='DELETE'&&!action)return json(res,200,key==='products'?business.removeProduct(id):business.remove(key,id));
        if(req.method==='PATCH'&&!action){const data=await body(req);if(key==='products')return json(res,200,business.editProduct(id,data));if(key==='ledger')return json(res,200,business.updateLedger(id,data));if(key==='campaigns')return json(res,200,business.editCampaign(id,data));if(key==='tasks')return json(res,200,business.updateTask(id,data));}
        if(key==='campaigns'&&req.method==='POST'&&action==='approve')return json(res,200,business.approve(id,await body(req)));
        if(key==='campaigns'&&req.method==='POST'&&action==='published')return json(res,200,business.published(id,await body(req)));
        if(key==='tasks'&&req.method==='POST'&&action==='run')return json(res,200,await business.runTask(id));
        if(key==='campaigns'&&req.method==='GET'&&action==='export') {const c=store.read().campaigns.find(x=>x.id===id);if(!c)throw error('Campanha não encontrada.',404);const content=Object.entries(c.content).map(([k,v])=>k.toUpperCase()+'\n'+v).join('\n\n');res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','Content-Disposition':'attachment; filename="campanha-'+id+'.txt"'});return res.end(content);}
      }
      return json(res,404,{error:'Operação não disponível. Publicação, envio automático e serviços pagos estão desativados.'});
    } catch(e){return json(res,e.status||500,{error:e.status?e.message:'Erro interno. Nenhuma ação externa foi executada.'});}
  });
  server.requestTimeout=30000;server.headersTimeout=15000;
  server.on('close',()=>{if(timer)clearInterval(timer);store.close();});
  function startScheduler(){if(!timer){timer=setInterval(()=>business.tick().catch(()=>{}),30000);timer.unref();}}
  return {server,store,business,providers,startScheduler};
}
if(require.main===module) {
  if(!process.env.VERIS_PASSWORD_HASH){console.error('Configure o acesso privado com npm run setup antes de iniciar.');process.exit(1);}
  const host=process.env.HOST||'127.0.0.1';
  try{validateBinding(host);const app=createApp();app.server.listen(Number(process.env.PORT||3100),host,()=>{app.startScheduler();console.log('VERIS-AI pronta na porta '+app.server.address().port);});for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>app.server.close(()=>process.exit(0)));}catch(e){console.error(e.message.startsWith('Bind público')?e.message:'Não foi possível abrir o banco. Confira a configuração e se outra VERIS está em execução.');process.exit(1);}
}
module.exports={createApp,validateBinding};
