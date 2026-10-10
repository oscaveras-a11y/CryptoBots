// Additional programming guidance for the CODE agent.
export const advancedLessons = [
 {id:'distributed',tags:['distributed','queue','retry'],title:'Distributed systems',guidance:'Use idempotency, deadlines, bounded retries and recovery tests.',checks:['Test duplicate events','Test partial failure']},
 {id:'observability',tags:['logs','metrics','tracing'],title:'Observability',guidance:'Use structured logs, latency metrics and correlated traces.',checks:['Inspect logs','Verify alerts']},
 {id:'frontend',tags:['frontend','react','accessibility'],title:'Accessible frontend',guidance:'Use semantic controls, responsive layouts and keyboard navigation.',checks:['Test keyboard','Test mobile']},
 {id:'mobile',tags:['mobile','pwa','offline'],title:'Offline mobile applications',guidance:'Handle cache invalidation, offline data and sync conflicts.',checks:['Test offline','Test reconnect']},
 {id:'api',tags:['api','http','rest'],title:'API engineering',guidance:'Validate inputs, version contracts and return consistent errors.',checks:['Test invalid requests','Test compatibility']},
 {id:'concurrency',tags:['concurrency','race','async'],title:'Concurrency',guidance:'Control shared state, cancellation and transaction boundaries.',checks:['Test races','Test cancellation']},
 {id:'deployment',tags:['deployment','ci','release'],title:'Deployment',guidance:'Use reproducible builds, staged releases and rollback plans.',checks:['Check CI','Test rollback']},
 {id:'containers',tags:['docker','container','kubernetes'],title:'Containers',guidance:'Use least privilege and bounded resources.',checks:['Check privileges','Set limits']},
 {id:'algorithms',tags:['algorithm','complexity','structures'],title:'Algorithms',guidance:'Assess time complexity, memory usage and edge cases.',checks:['Review complexity','Test boundaries']},
 {id:'git',tags:['git','github','merge'],title:'Version control',guidance:'Keep changes focused and reviewed with passing tests.',checks:['Review diff','Check tests']},
 {id:'privacy',tags:['privacy','encryption','data'],title:'Privacy',guidance:'Minimize data, enforce retention and access controls.',checks:['Review retention','Test access']},
 {id:'ai',tags:['ai','llm','rag'],title:'AI integration',guidance:'Ground responses, validate outputs and isolate untrusted inputs.',checks:['Validate output','Test fallback']}
];
