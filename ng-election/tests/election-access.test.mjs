import test from 'node:test';
import assert from 'node:assert/strict';
import { isAgentAccessOpen } from '../lib/election-access.ts';

test('missing control is locked by default', () => assert.equal(isAgentAccessOpen(null, new Date('2027-01-16T12:00:00Z')), false));
test('manual open overrides scheduled window', () => assert.equal(isAgentAccessOpen({ access_mode: 'open', opens_at: null, closes_at: null }, new Date('2027-01-16T12:00:00Z')), true));
test('manual lock overrides scheduled window', () => assert.equal(isAgentAccessOpen({ access_mode: 'locked', opens_at: '2027-01-16T00:00:00Z', closes_at: '2027-01-17T00:00:00Z' }, new Date('2027-01-16T12:00:00Z')), false));
test('scheduled mode opens inclusively at opening time', () => assert.equal(isAgentAccessOpen({ access_mode: 'scheduled', opens_at: '2027-01-16T00:00:00Z', closes_at: '2027-01-17T00:00:00Z' }, new Date('2027-01-16T00:00:00Z')), true));
test('scheduled mode closes at closing time', () => assert.equal(isAgentAccessOpen({ access_mode: 'scheduled', opens_at: '2027-01-16T00:00:00Z', closes_at: '2027-01-17T00:00:00Z' }, new Date('2027-01-17T00:00:00Z')), false));
test('invalid scheduled timestamps remain locked', () => assert.equal(isAgentAccessOpen({ access_mode: 'scheduled', opens_at: 'bad', closes_at: 'also bad' }, new Date()), false));
