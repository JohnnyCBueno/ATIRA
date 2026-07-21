import assert from 'node:assert/strict';
import test from 'node:test';
import { squirrelEventAction } from './squirrel-events.mjs';

test('Squirrel first-run launches the installed app', () => {
  assert.equal(squirrelEventAction('--squirrel-firstrun'), 'launch');
});

test('Squirrel maintenance events do not launch the normal app lifecycle', () => {
  assert.equal(squirrelEventAction('--squirrel-install'), 'create-shortcut');
  assert.equal(squirrelEventAction('--squirrel-updated'), 'create-shortcut');
  assert.equal(squirrelEventAction('--squirrel-uninstall'), 'remove-shortcut');
  assert.equal(squirrelEventAction('--squirrel-obsolete'), 'quit');
});
