import test from 'node:test';
import assert from 'node:assert/strict';
import { createTorFetch } from '../src/tor-fetch.js';
test('Tor transport requires remote DNS and cannot bypass proxy or redirect', async()=>{
 let args;const request=createTorFetch({run:async(file,a)=>{args=a;return {stdout:'{"query":{"search":[]}}\n200'};}});
 const response=await request('https://pt.wikipedia.org/w/api.php?x=test');assert.equal(response.ok,true);assert.deepEqual(await response.json(),{query:{search:[]}});
 assert.ok(args.includes('--socks5-hostname'));assert.ok(args.includes('127.0.0.1:9050'));assert.ok(!args.includes('--location'));assert.ok(args.includes('--disable'));assert.equal(args[args.indexOf('--connect-timeout')+1],'15');assert.ok(args.includes('--noproxy'));assert.equal(args[args.indexOf('--noproxy')+1],'');
 await assert.rejects(()=>request('https://example.com/'),/research_destination_blocked/);
});
test('proxy failure never falls back to direct fetch',async()=>{
 let count=0;const request=createTorFetch({run:async()=>{count++;throw new Error('proxy refused');}});await assert.rejects(()=>request('https://api.openalex.org/works'),/tor_transport_unavailable/);assert.equal(count,1);
});
