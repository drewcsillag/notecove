/**
 * Stability Reporter for Playwright E2E Tests
 *
 * Tracks test stability metrics over time to identify flaky tests.
 * Stores results in a local JSON file for analysis.
 */

import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

interface TestMetrics {
  title: string;
  file: string;
  runs: number;
  passes: number;
  failures: number;
  retries: number;
  passRate: number;
  lastRun: string;
  lastStatus: 'passed' | 'failed' | 'flaky' | 'skipped';
  averageDuration: number;
  durations: number[];
}

interface StabilityData {
  version: number;
  lastUpdated: string;
  totalRuns: number;
  tests: Record<string, TestMetrics>;
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    flakyTests: number;
    skippedTests: number;
    overallPassRate: number;
  };
}

const STABILITY_FILE = 'test-results/stability-metrics.json';
const MAX_DURATION_HISTORY = 10;

class StabilityReporter implements Reporter {
  private data: StabilityData;
  private currentRun: Map<string, { passed: boolean; retried: boolean; duration: number }> =
    new Map();

  constructor() {
    this.data = this.loadData();
  }

  private loadData(): StabilityData {
    const filePath = join(process.cwd(), STABILITY_FILE);
    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
      } catch {
        console.log('[StabilityReporter] Could not load existing data, starting fresh');
      }
    }
    return {
      version: 1,
      lastUpdated: new Date().toISOString(),
      totalRuns: 0,
      tests: {},
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        flakyTests: 0,
        skippedTests: 0,
        overallPassRate: 0,
      },
    };
  }

  private saveData(): void {
    const filePath = join(process.cwd(), STABILITY_FILE);
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filePath, JSON.stringify(this.data, null, 2));
  }

  private getTestKey(test: TestCase): string {
    return `${test.parent.title} > ${test.title}`;
  }

  onBegin(_config: FullConfig, _suite: Suite): void {
    this.currentRun.clear();
    this.data.totalRuns++;
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const key = this.getTestKey(test);
    const existing = this.currentRun.get(key);

    // Track if this test was retried
    const isRetry = result.retry > 0;
    const passed = result.status === 'passed';

    if (existing) {
      // This is a retry - update the record
      this.currentRun.set(key, {
        passed: passed || existing.passed,
        retried: true,
        duration: result.duration,
      });
    } else {
      this.currentRun.set(key, {
        passed,
        retried: isRetry,
        duration: result.duration,
      });
    }
  }

  onEnd(_result: FullResult): void {
    const now = new Date().toISOString();

    // Update metrics for each test in this run
    for (const [key, runResult] of this.currentRun.entries()) {
      if (!this.data.tests[key]) {
        this.data.tests[key] = {
          title: key,
          file: '',
          runs: 0,
          passes: 0,
          failures: 0,
          retries: 0,
          passRate: 0,
          lastRun: now,
          lastStatus: 'passed',
          averageDuration: 0,
          durations: [],
        };
      }

      const metrics = this.data.tests[key];
      metrics.runs++;
      metrics.lastRun = now;

      if (runResult.passed) {
        metrics.passes++;
        metrics.lastStatus = runResult.retried ? 'flaky' : 'passed';
      } else {
        metrics.failures++;
        metrics.lastStatus = 'failed';
      }

      if (runResult.retried) {
        metrics.retries++;
      }

      metrics.passRate = (metrics.passes / metrics.runs) * 100;

      // Track duration history
      metrics.durations.push(runResult.duration);
      if (metrics.durations.length > MAX_DURATION_HISTORY) {
        metrics.durations.shift();
      }
      metrics.averageDuration =
        metrics.durations.reduce((a, b) => a + b, 0) / metrics.durations.length;
    }

    // Calculate summary
    const tests = Object.values(this.data.tests);
    this.data.summary = {
      totalTests: tests.length,
      passedTests: tests.filter((t) => t.lastStatus === 'passed').length,
      failedTests: tests.filter((t) => t.lastStatus === 'failed').length,
      flakyTests: tests.filter((t) => t.lastStatus === 'flaky' || (t.retries > 0 && t.passes > 0))
        .length,
      skippedTests: tests.filter((t) => t.lastStatus === 'skipped').length,
      overallPassRate:
        tests.length > 0 ? tests.reduce((a, t) => a + t.passRate, 0) / tests.length : 0,
    };

    this.data.lastUpdated = now;
    this.saveData();

    // Print summary
    console.log('\n[Stability Report]');
    console.log(`  Total runs: ${this.data.totalRuns}`);
    console.log(`  Tests: ${this.data.summary.totalTests}`);
    console.log(`  Passed: ${this.data.summary.passedTests}`);
    console.log(`  Failed: ${this.data.summary.failedTests}`);
    console.log(`  Flaky: ${this.data.summary.flakyTests}`);
    console.log(`  Overall pass rate: ${this.data.summary.overallPassRate.toFixed(1)}%`);

    // List flaky tests
    const flakyTests = tests.filter((t) => t.retries > 0 && t.passes > 0);
    if (flakyTests.length > 0) {
      console.log('\n  Flaky tests:');
      for (const t of flakyTests.slice(0, 5)) {
        console.log(`    - ${t.title} (${t.passRate.toFixed(0)}% pass rate, ${t.retries} retries)`);
      }
    }
  }
}

export default StabilityReporter;
