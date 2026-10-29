import test from 'node:test';
import assert from 'node:assert/strict';
import {trainingRows} from '../src/data-rows.js';
import {cleanData,samples} from '../src/model.js';
import {modelTypes,trainingStages,learningRoutes,conceptScenario} from '../src/concept-data.js';

test('visible removed rows match the sentences actually excluded from training', () => {
  const rows = trainingRows();
  const retained = rows.filter(row => row.duplicateOf === null);
  const removed = rows.filter(row => row.duplicateOf !== null);
  assert.equal(removed.length, 3);
  assert.ok(removed.some(row => row.line <= 8));
  for (const row of removed) {
    const original = rows.find(candidate => candidate.line === row.duplicateOf);
    assert.equal(original.text, row.text);
    assert.equal(original.duplicateOf, null);
    assert.ok(original.line < row.line);
  }
  assert.deepEqual(retained.map(row => row.text), cleanData(true));
  assert.deepEqual(rows.map(row => row.text), cleanData(false));
  assert.equal(samples(retained.map(row => row.text)).length, 447);
  assert.equal(samples(rows.map(row => row.text)).length, 489);
  assert.deepEqual(trainingRows(), rows, 'reopening the preview keeps source line identities');
});

test('all 36 combinations preserve the three independently chosen dimensions', () => {
  let count = 0;
  for (const type of modelTypes) for (const stage of trainingStages) for (const route of learningRoutes) {
    const result = conceptScenario(type,stage,route);
    assert.deepEqual([result.type,result.stage,result.route], [type,stage,route]);
    for (const field of ['title','who','start','data','target','change','result']) {
      assert.equal(typeof result[field], 'string');
      assert.ok(result[field].length > 0, `${type}/${stage}/${route}: ${field}`);
    }
    if (type === '具身智能模型') {
      assert.match(result.target, /观测|动作|控制策略/);
      assert.doesNotMatch(result.target, /示范回答|回答对|文本 DPO/);
    }
    count++;
  }
  assert.equal(count, 36);
});
