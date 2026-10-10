import { createHash } from 'node:crypto';

// Deterministic code generator for explicitly supported tasks. No model dependency.
const sha=s=>createHash('sha256').update(s).digest('hex');
const templates={
 'sum':{path:'generated/sum.mjs',content:'export function sum(a,b) { if (!Number.isFinite(a) || !Number.isFinite(b)) throw new TypeError("finite numbers required"); return a+b; }\n',test:'import test from "node:test"; import assert from "node:assert/strict"; import {sum} from "./sum.mjs"; test("sum",()=>{assert.equal(sum(2,3),5);assert.throws(()=>sum("2",3),TypeError);});\n'},
 'slug':{path:'generated/slug.mjs',content:'export function slug(value) { if(typeof value!=="string") throw new TypeError("string required"); return value.normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""); }\n',test:'import test from "node:test"; import assert from "node:assert/strict"; import {slug} from "./slug.mjs"; test("slug",()=>{assert.equal(slug("Olá Mundo"),"ola-mundo");assert.throws(()=>slug(null),TypeError);});\n'}
};
export async function generateCodeChanges({instruction='',files=[]}={}) {
 if(typeof instruction!=='string'||!Array.isArray(files))throw new TypeError('invalid_generation_input');
 const topic=instruction.toLowerCase();
 const key=/\b(slug|url amig[aá]vel)\b/.test(topic)?'slug':/\b(som(ar|a)|sum|adi[cç][aã]o)\b/.test(topic)?'sum':null;
 if(!key)return {status:'unsupported_generation_task',changes:[],supportedTasks:Object.keys(templates)};
 const t=templates[key];
 const changes=[{path:t.path,content:t.content},{path:t.path.replace('.mjs','.test.mjs'),content:t.test}];
 return {status:'generated',generator:'deterministic-templates-v1',changes:changes.map(c=>({...c,expectedSha256:files.some(f=>f.path===c.path)?sha(files.find(f=>f.path===c.path).content):null}))};
}
