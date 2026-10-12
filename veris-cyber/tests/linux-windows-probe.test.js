import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {checkWindowsTcpPorts} from '../agents/cyber/linux-windows-probe.js';
test('probe refuses absent authorization and invalid targets',async()=>{
 assert.equal((await checkWindowsTcpPorts({host:'127.0.0.1'})).status,'authorization_required');
 assert.equal((await checkWindowsTcpPorts({host:'example.com',authorization:{confirmed:true,target:'example.com'}})).status,'invalid_host');
 assert.equal((await checkWindowsTcpPorts({host:'127.0.0.1',authorization:{confirmed:true,target:'192.0.2.1'}})).status,'authorization_required');
});
test('probe checks only the explicitly approved local port',async()=>{
 const server=net.createServer(socket=>socket.end());
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const port=server.address().port;
  const r=await checkWindowsTcpPorts({host:'127.0.0.1',ports:[port],authorization:{confirmed:true,target:'127.0.0.1'}});
  assert.equal(r.status,'completed');
  assert.deepEqual(r.results,[{port,state:'open'}]);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
test('probe rejects excessive port lists',async()=>{
 const r=await checkWindowsTcpPorts({host:'127.0.0.1',ports:Array.from({length:17},(_,i)=>i+1),authorization:{confirmed:true,target:'127.0.0.1'}});
 assert.equal(r.status,'invalid_ports');
});
