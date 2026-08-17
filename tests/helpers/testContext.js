/**
 * TuneTagZ Test Suite — Test Context & Assertion Framework
 * Provides lightweight, zero-dependency assertions, execution tracking,
 * and reporting for all 4 test tiers.
 */

const assert = require('assert');

// ANSI Color codes
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m'
};

class TestContext {
  constructor(testName = '', tier = 1, featureId = '') {
    this.testName = testName;
    this.tier = tier;
    this.featureId = featureId;
    this.assertions = 0;
    this.passedAssertions = 0;
    this.failedAssertions = 0;
    this.errors = [];
    this.startTime = Date.now();
    this.endTime = null;
  }

  assert(condition, message = 'Assertion failed') {
    this.assertions++;
    if (condition) {
      this.passedAssertions++;
    } else {
      this.failedAssertions++;
      const err = new Error(`[${this.featureId || 'TEST'}] ${message}`);
      this.errors.push(err);
      throw err;
    }
  }

  assertEqual(actual, expected, message) {
    this.assertions++;
    try {
      assert.deepStrictEqual(actual, expected, message);
      this.passedAssertions++;
    } catch (err) {
      this.failedAssertions++;
      const customErr = new Error(`[${this.featureId || 'TEST'}] ${message || 'Values not equal'}: expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
      this.errors.push(customErr);
      throw customErr;
    }
  }

  assertNotEqual(actual, expected, message) {
    this.assertions++;
    try {
      assert.notDeepStrictEqual(actual, expected, message);
      this.passedAssertions++;
    } catch (err) {
      this.failedAssertions++;
      const customErr = new Error(`[${this.featureId || 'TEST'}] ${message || 'Values unexpectedly equal'}: received ${JSON.stringify(actual)}`);
      this.errors.push(customErr);
      throw customErr;
    }
  }

  assertOk(value, message = 'Value should be truthy') {
    this.assert(Boolean(value), message);
  }

  assertStatus(response, expectedStatus, message) {
    this.assertions++;
    const desc = message ? `${message} (expected HTTP ${expectedStatus}, got ${response.status})` : `Expected HTTP status ${expectedStatus}, got ${response.status}: ${JSON.stringify(response.data || response.text)}`;
    if (response.status === expectedStatus) {
      this.passedAssertions++;
    } else {
      this.failedAssertions++;
      const err = new Error(`[${this.featureId || 'TEST'}] ${desc}`);
      this.errors.push(err);
      throw err;
    }
  }

  assertIncludes(actual, substringOrElement, message) {
    this.assertions++;
    let passed = false;
    if (typeof actual === 'string') {
      passed = actual.includes(substringOrElement);
    } else if (Array.isArray(actual)) {
      passed = actual.includes(substringOrElement);
    } else if (typeof actual === 'object' && actual !== null) {
      passed = substringOrElement in actual;
    }

    if (passed) {
      this.passedAssertions++;
    } else {
      this.failedAssertions++;
      const err = new Error(`[${this.featureId || 'TEST'}] ${message || 'Expected item not found'}: ${JSON.stringify(actual)} does not include ${JSON.stringify(substringOrElement)}`);
      this.errors.push(customErr);
      throw err;
    }
  }

  assertMatch(actual, regex, message) {
    this.assertions++;
    if (typeof actual === 'string' && regex.test(actual)) {
      this.passedAssertions++;
    } else {
      this.failedAssertions++;
      const err = new Error(`[${this.featureId || 'TEST'}] ${message || 'Pattern match failed'}: "${actual}" does not match ${regex}`);
      this.errors.push(err);
      throw err;
    }
  }

  finish() {
    this.endTime = Date.now();
    return {
      testName: this.testName,
      tier: this.tier,
      featureId: this.featureId,
      assertions: this.assertions,
      passedAssertions: this.passedAssertions,
      failedAssertions: this.failedAssertions,
      passed: this.failedAssertions === 0 && this.assertions > 0,
      durationMs: this.endTime - this.startTime,
      errors: this.errors
    };
  }
}

module.exports = {
  TestContext,
  COLORS
};
