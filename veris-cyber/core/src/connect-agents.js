import sense from '../../agents/sense/index.js';
import mind from '../../agents/mind/index.js';
import memory from '../../agents/memory/index.js';
import planner from '../../agents/planner/index.js';
import research from '../../agents/research/index.js';
import vision from '../../agents/vision/index.js';
import voice from '../../agents/voice/index.js';
import code from '../../agents/code/index.js';
import cyber from '../../agents/cyber/index.js';
import action from '../../agents/action/index.js';
import guard from '../../agents/guard/index.js';
import verify from '../../agents/verify/index.js';

export function connectAgents(core) {
  for (const [name,handler] of Object.entries({ sense, mind, memory, planner, research, vision, voice, code, cyber, action, guard, verify })) core.register(name,handler);
  return core;
}
