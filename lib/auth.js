'use strict';
const crypto = require('node:crypto');
function equal(a,b) { if(typeof a!=='string'||typeof b!=='string'||!a||!b)return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&crypto.timingSafeEqual(x,y); }
function hashPassword(password) {const salt=crypto.randomBytes(16).toString('hex');return salt+':'+crypto.scryptSync(password,salt,64).toString('hex');}
function checkPassword(password,hash) {if(typeof password!=='string'||password.length>200||!hash)return false;const [salt,digest]=hash.split(':');if(!/^[a-f0-9]{32}$/.test(salt)||!/^[a-f0-9]{128}$/.test(digest||''))return false;return equal(crypto.scryptSync(password,salt,64).toString('hex'),digest);}
class Auth {
  constructor(env) {this.env=env;this.sessions=new Map();this.buckets=new Map();this.nextBucketPrune=0;}
  limited(req,kind,limit=120) {
    const key=kind+':'+req.socket.remoteAddress,now=Date.now();
    if(now>=this.nextBucketPrune){for(const [k,v] of this.buckets)if(v.until<=now)this.buckets.delete(k);this.nextBucketPrune=now+30000;}
    let b=this.buckets.get(key);if(!b||b.until<=now){this.buckets.delete(key);if(this.buckets.size>=4000)this.buckets.delete(this.buckets.keys().next().value);b={count:0,until:now+60000};this.buckets.set(key,b);}return ++b.count>limit;
  }
  session(req) {const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('veris_session='))?.slice(14);const s=this.sessions.get(token);if(s&&s.until>Date.now())return s;if(token)this.sessions.delete(token);return null;}
  owner(req) {const key=this.env.VERIS_OWNER_API_KEY;return key?.length>=32&&equal(req.headers.authorization,'Bearer '+key);}
  sameOrigin(req) {try {const u=new URL(req.headers.origin);return u.host===req.headers.host&&['http:','https:'].includes(u.protocol);}catch{return false;}}
  authorized(req,write=false) {if(this.owner(req))return true;const s=this.session(req);return !!s&&(!write||(this.sameOrigin(req)&&equal(req.headers['x-csrf-token'],s.csrf)));}
  login(password) {if(!checkPassword(password,this.env.VERIS_PASSWORD_HASH))return null;const now=Date.now();for(const [k,s]of this.sessions)if(s.until<now)this.sessions.delete(k);while(this.sessions.size>=20)this.sessions.delete(this.sessions.keys().next().value);const token=crypto.randomBytes(32).toString('hex'),csrf=crypto.randomBytes(24).toString('hex');this.sessions.set(token,{token,csrf,until:now+8*3600000});return {token,csrf};}
  cookie(token,clear=false) {return 'veris_session='+token+'; HttpOnly; SameSite=Strict; Path=/; Max-Age='+(clear?0:28800)+(this.env.NODE_ENV==='production'||this.env.VERIS_COOKIE_SECURE==='true'?'; Secure':'');}
  logout(req) {const s=this.session(req);if(s)this.sessions.delete(s.token);}
}
module.exports={Auth,hashPassword};
