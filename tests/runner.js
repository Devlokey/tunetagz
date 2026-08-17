#!/usr/bin/env node
/**
 * TuneTagZ E2E Test Suite Runner
 * Executes 4 tiers of comprehensive requirement-driven opaque-box tests.
 * Zero external test framework dependencies (uses standard Node.js).
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { HttpClient } = require('./helpers/httpClient');
const { TestContext, COLORS } = require('./helpers/testContext');
const { startServer, stopServer } = require('./helpers/serverHelper');

const PROJECT_ROOT = path.resolve(__dirname, '..');

// CLI options
const args = process.argv.slice(2);
const options = {
  tier: null,
  feature: null,
  bail: args.includes('--bail'),
  tap: args.includes('--tap'),
  port: process.env.PORT || 3000,
  verbose: args.includes('--verbose') || args.includes('-v')
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--tier' && args[i + 1]) options.tier = parseInt(args[i + 1], 10);
  if (args[i] === '--feature' && args[i + 1]) options.feature = args[i + 1].toUpperCase();
  if (args[i] === '--port' && args[i + 1]) options.port = parseInt(args[i + 1], 10);
}

const TIER_DIRS = {
  1: path.join(__dirname, 'tier1_features'),
  2: path.join(__dirname, 'tier2_boundaries'),
  3: path.join(__dirname, 'tier3_combinations'),
  4: path.join(__dirname, 'tier4_scenarios')
};

function getTestFiles(tier) {
  const dir = TIER_DIRS[tier];
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.test.js'))
    .sort()
    .map(f => ({
      name: f,
      filePath: path.join(dir, f),
      tier
    }));
}

function matchesFeature(fileName, targetFeature) {
  if (!targetFeature) return true;
  const target = targetFeature.toUpperCase(); // e.g. "F1" or "F14"
  const digits = target.replace(/\D/g, '');
  if (!digits) return fileName.toUpperCase().includes(target);

  const padded = 'f' + digits.padStart(2, '0'); // e.g. "f01"
  return fileName.toLowerCase().startsWith(padded) || fileName.toUpperCase().includes(target + '_');
}

function printHeader() {
  console.log(`\n${COLORS.cyan}${COLORS.bright}=========================================================================${COLORS.reset}`);
  console.log(`${COLORS.cyan}${COLORS.bright}       TUNETAGZ E2E COMPREHENSIVE AUTOMATED TEST SUITE (TIERS 1-4)       ${COLORS.reset}`);
  console.log(`${COLORS.cyan}${COLORS.bright}=========================================================================${COLORS.reset}`);
  console.log(`${COLORS.dim}Node.js: ${process.version} | Architecture: x64 | Target: http://localhost:${options.port}${COLORS.reset}\n`);
}

function printTierHeader(tierNumber, tierTitle) {
  console.log(`\n${COLORS.blue}${COLORS.bright}┌────────────────────────────────────────────────────────────────────────┐${COLORS.reset}`);
  console.log(`${COLORS.blue}${COLORS.bright}│ TIER ${tierNumber}: ${tierTitle.padEnd(62)}│${COLORS.reset}`);
  console.log(`${COLORS.blue}${COLORS.bright}└────────────────────────────────────────────────────────────────────────┘${COLORS.reset}`);
}

async function runTestFile(testFile, client) {
  const testModule = require(testFile.filePath);
  const testName = testModule.title || path.basename(testFile.name, '.test.js');
  const featureId = testModule.featureId || '';
  const context = new TestContext(testName, testFile.tier, featureId);

  try {
    if (typeof testModule.run === 'function') {
      await testModule.run(context, client);
    } else if (typeof testModule === 'function') {
      await testModule(context, client);
    }
  } catch (err) {
    if (!context.errors.includes(err)) {
      context.errors.push(err);
      context.failedAssertions++;
    }
  }

  const result = context.finish();
  result.filePath = testFile.filePath;
  result.fileName = testFile.name;
  return result;
}

function printTestResult(result, index) {
  const status = result.passed
    ? `${COLORS.green}✔ PASS${COLORS.reset}`
    : `${COLORS.red}✖ FAIL${COLORS.reset}`;
  const featureTag = result.featureId ? `[${result.featureId}] ` : '';
  const duration = `${COLORS.dim}(${result.durationMs}ms, ${result.assertions} asserts)${COLORS.reset}`;

  console.log(`  ${status}  ${featureTag}${result.testName} ${duration}`);

  if (!result.passed && result.errors.length > 0) {
    for (const err of result.errors) {
      console.log(`      ${COLORS.red}↳ ${err.message}${COLORS.reset}`);
      if (options.verbose && err.stack) {
        console.log(`        ${COLORS.dim}${err.stack.split('\n').slice(1, 4).join('\n        ')}${COLORS.reset}`);
      }
    }
  }
}

async function main() {
  printHeader();

  let serverInfo = null;
  try {
    console.log(`${COLORS.yellow}Checking backend server status on port ${options.port}...${COLORS.reset}`);
    serverInfo = await startServer(options.port);
    console.log(`${COLORS.green}✔ Backend server is active at ${serverInfo.baseUrl}${COLORS.reset}\n`);
  } catch (err) {
    console.error(`${COLORS.red}✖ Failed to start/connect to backend server:${COLORS.reset}`, err.message);
    process.exit(1);
  }

  const client = new HttpClient(serverInfo.baseUrl);

  const tierTitles = {
    1: 'FEATURE VERIFICATION (F1 - F28, >=5 Assertions Each)',
    2: 'BOUNDARY, EDGE CASES & TAMPER RESISTANCE',
    3: 'PAIRWISE CROSS-FEATURE WORKFLOW COMBINATIONS',
    4: 'REAL-WORLD APPLICATION WORKLOAD SCENARIOS'
  };

  const allResults = [];
  let totalAssertions = 0;
  let passedAssertions = 0;
  let failedAssertions = 0;
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  const startTime = Date.now();

  const tiersToRun = options.tier ? [options.tier] : [1, 2, 3, 4];

  for (const tier of tiersToRun) {
    let files = getTestFiles(tier);

    if (options.feature) {
      files = files.filter(f => matchesFeature(f.name, options.feature));
    }

    if (files.length === 0) continue;

    printTierHeader(tier, tierTitles[tier] || `TIER ${tier}`);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const result = await runTestFile(file, client);
      allResults.push(result);

      totalTests++;
      totalAssertions += result.assertions;
      passedAssertions += result.passedAssertions;
      failedAssertions += result.failedAssertions;

      if (result.passed) {
        passedTests++;
      } else {
        failedTests++;
      }

      printTestResult(result, i + 1);

      if (options.bail && !result.passed) {
        console.log(`\n${COLORS.red}Bailing out after first test failure (--bail active).${COLORS.reset}`);
        break;
      }
    }
  }

  const totalDuration = Date.now() - startTime;

  // Print Summary Table
  console.log(`\n${COLORS.cyan}${COLORS.bright}=========================================================================${COLORS.reset}`);
  console.log(`${COLORS.cyan}${COLORS.bright}                            TEST EXECUTION SUMMARY                       ${COLORS.reset}`);
  console.log(`${COLORS.cyan}${COLORS.bright}=========================================================================${COLORS.reset}`);

  console.log(`  ${COLORS.bright}Total Test Suites:${COLORS.reset}  ${totalTests}`);
  console.log(`  ${COLORS.green}${COLORS.bright}Passed Test Suites:${COLORS.reset} ${passedTests}`);
  console.log(`  ${failedTests > 0 ? COLORS.red : COLORS.dim}${COLORS.bright}Failed Test Suites:${COLORS.reset} ${failedTests}`);
  console.log(`  ${COLORS.bright}Total Assertions:${COLORS.reset}   ${totalAssertions}`);
  console.log(`  ${COLORS.green}Passed Assertions:${COLORS.reset}  ${passedAssertions}`);
  console.log(`  ${failedAssertions > 0 ? COLORS.red : COLORS.dim}Failed Assertions:${COLORS.reset}  ${failedAssertions}`);
  console.log(`  ${COLORS.bright}Total Execution Time:${COLORS.reset} ${(totalDuration / 1000).toFixed(2)}s`);
  console.log(`${COLORS.cyan}-------------------------------------------------------------------------${COLORS.reset}`);

  // Feature Coverage Matrix Checklist (Tier 1)
  const tier1Results = allResults.filter(r => r.tier === 1);
  if (tier1Results.length > 0) {
    console.log(`\n${COLORS.bright}Feature Coverage Matrix (T1 Features F1-F28):${COLORS.reset}`);
    const featureMap = {};
    for (const r of tier1Results) {
      if (r.featureId) {
        featureMap[r.featureId] = r;
      }
    }

    for (let f = 1; f <= 28; f++) {
      const fid = `F${f}`;
      const res = featureMap[fid];
      if (res) {
        const mark = res.passed ? `${COLORS.green}✔${COLORS.reset}` : `${COLORS.red}✖${COLORS.reset}`;
        console.log(`  ${mark} ${fid.padEnd(4)}: ${res.testName} (${res.assertions} assertions)`);
      } else {
        console.log(`  ${COLORS.yellow}○${COLORS.reset} ${fid.padEnd(4)}: Pending execution`);
      }
    }
  }

  stopServer();

  if (failedTests > 0 || failedAssertions > 0 || totalTests === 0) {
    console.log(`\n${COLORS.bgRed}${COLORS.white}${COLORS.bright}  TEST RUN FAILED  ${COLORS.reset} ${failedTests} suite(s) failed (${failedAssertions} assertion error(s))\n`);
    process.exit(1);
  } else {
    console.log(`\n${COLORS.bgGreen}${COLORS.white}${COLORS.bright}  ALL TESTS PASSED  ${COLORS.reset} 100% of ${totalTests} test suites and ${totalAssertions} assertions verified\n`);
    process.exit(0);
  }
}

main().catch(err => {
  console.error(`\n${COLORS.red}Fatal test runner error:${COLORS.reset}`, err);
  stopServer();
  process.exit(1);
});
