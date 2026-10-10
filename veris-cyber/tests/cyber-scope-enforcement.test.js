import test from 'node:test';
import assert from 'node:assert/strict';
import cyber from '../agents/cyber/index.js';

const allowed = {
  target: 'local-lab',
  activity: 'security-audit',
  authorization: {
    confirmed: true,
    targets: ['local-lab'],
    activities: ['security-audit']
  }
};

test('CYBER blocks unauthorized scanner calls even with an injected adapter', async () => {
  let called = 0;
  const scanner = async () => { called++; return { status: 'completed', executed: true }; };
  const cases = [
    {},
    { ...allowed, authorization: { confirmed: true } },
    { ...allowed, target: 'other-host' },
    { ...allowed, activity: 'exploit' },
    { ...allowed, authorization: { ...allowed.authorization, deniedTargets: ['local-lab'] } }
  ];
  for (const data of cases) {
    const result = await cyber({ instruction: 'audit', data }, { cyberOperation: scanner });
    assert.equal(result.status, 'blocked');
    assert.equal(result.executed, false);
  }
  assert.equal(called, 0);
});

test('CYBER only calls scanner for explicitly allowed target and activity', async () => {
  let called = 0;
  const result = await cyber({ instruction: 'audit', data: allowed }, {
    cyberOperation: async data => {
      called++;
      assert.equal(data.target, 'local-lab');
      return { status: 'completed', executed: true };
    }
  });
  assert.equal(called, 1);
  assert.equal(result.status, 'completed');
});

test('CYBER requires adapter and validates its result', async () => {
  const pending = await cyber({ instruction: 'audit', data: allowed });
  assert.equal(pending.status, 'requires_scanner_and_execution_approval');
  await assert.rejects(
    () => cyber({ instruction: 'audit', data: allowed }, { cyberOperation: async () => null }),
    /invalid_cyber_result/
  );
});
