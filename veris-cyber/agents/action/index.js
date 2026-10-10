// ACTION only executes a host-authorized, injected tool adapter.
export default async function action({instruction='',data={}}={},context={}){
 if(typeof context.executeAction!=='function')return {status:'requires_tool_adapter',instruction,executed:false};
 if(context.signal?.aborted)throw new Error('action_aborted');
 const result=await context.executeAction({instruction,data},{signal:context.signal});
 if(context.signal?.aborted)throw new Error('action_aborted');
 if(!result||typeof result.status!=='string')throw new Error('invalid_action_result');
 return result;
}
