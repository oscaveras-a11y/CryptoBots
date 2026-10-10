// Inventory only. Declared ranges are not resolved versions or evidence of safety.
export function inventoryDependencies(files) {
 const packages=[],warnings=[];
 const add=(name,version,source,kind)=>{
  if(typeof name!=='string'||!/^(@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(name)||typeof version!=='string'||version.length>100)return;
  if(packages.length>=1000)return;
  // URL/file/git specifiers can carry passwords, tokens or local private paths.
  const registry=/^[\d\sv*^~<>=|.,+-]+$/.test(version);
  packages.push({name,version:registry?version:'[specifier omitted]',source,kind:registry?kind:'non_registry',ecosystem:'npm',vulnerabilityStatus:'not_checked'});
 };
 for(const {path,content} of files){
  if(!/(^|\/)(package(?:-lock)?\.json)$/.test(path))continue;
  try{
   const data=JSON.parse(content);
   if(path.endsWith('package-lock.json')){
    for(const [location,value] of Object.entries(data.packages??{})){
     if(!location.includes('node_modules/')||!value||typeof value!=='object')continue;
     add(location.split('node_modules/').at(-1),value.version,path,'locked');
    }
    if(!data.packages)warnings.push({source:path,reason:'unsupported_lockfile_format'});
   }else{
    for(const group of ['dependencies','devDependencies','optionalDependencies'])for(const [name,version] of Object.entries(data[group]??{}))add(name,version,path,'declared');
   }
  }catch{warnings.push({source:path,reason:'invalid_dependency_manifest'});}
 }
 return {packages,warnings,truncated:packages.length>=1000,networkUsed:false};
}
