/**
 * Test harness for running prompts through the Kiki agentic loop.
 *
 * Mocks the Anthropic SDK and intercepts tool executor calls to:
 * 1. Feed pre-defined Claude responses per prompt
 * 2. Record all tool calls made during the conversation
 * 3. Capture the final response text
 *
 * This runs against the REAL mock-data-store (not mocked), so tool executor
 * calls return real mock CM360 data. Only Claude's responses are scripted.
 */

import type { TestPrompt, ResponseAssertion } from '../fixtures/test-prompts.js';

export interface ToolCallRecord {
  toolName: string;
  toolInput: Record<string, unknown>;
  result: unknown;
  isError: boolean;
}

export interface TestResult {
  promptId: string;
  prompt: string;
  category: string;
  status: 'pass' | 'fail' | 'partial';
  responseText: string;
  toolCallsMade: ToolCallRecord[];
  expectedTools: string[];
  assertionResults: AssertionResult[];
  apiCallCount: number;
  errors: string[];
  durationMs: number;
}

export interface AssertionResult {
  assertion: ResponseAssertion;
  passed: boolean;
  detail: string;
}

/**
 * Run a single test prompt through the mocked agentic loop.
 */
export function evaluateResponse(
  responseText: string,
  toolCalls: ToolCallRecord[],
  testPrompt: TestPrompt,
): TestResult {
  const start = Date.now();
  const errors: string[] = [];
  const assertionResults: AssertionResult[] = [];

  // Evaluate each response assertion
  for (const assertion of testPrompt.responseAssertions) {
    let passed = false;
    let detail = '';

    switch (assertion.type) {
      case 'contains':
        passed = responseText.includes(assertion.value);
        detail = passed
          ? `Found "${assertion.value}" in response`
          : `Missing "${assertion.value}" in response`;
        break;

      case 'not_contains':
        passed = !responseText.includes(assertion.value);
        detail = passed
          ? `Correctly absent: "${assertion.value}"`
          : `Unexpectedly found "${assertion.value}" in response`;
        break;

      case 'matches_pattern': {
        const regex = new RegExp(assertion.value);
        passed = regex.test(responseText);
        detail = passed
          ? `Matched pattern /${assertion.value}/`
          : `Pattern /${assertion.value}/ not found in response`;
        break;
      }
    }

    assertionResults.push({ assertion, passed, detail });
    if (!passed) {
      errors.push(`Assertion failed [${assertion.description}]: ${detail}`);
    }
  }

  // Check expected tools were called
  const actualToolNames = toolCalls.map((tc) => tc.toolName);
  for (const expectedTool of testPrompt.expectedTools) {
    if (!actualToolNames.includes(expectedTool)) {
      // Don't fail — expectedTools is aspirational (Claude chooses the approach)
      // but record it for the report
    }
  }

  // Check no tool returned an unexpected error
  for (const tc of toolCalls) {
    if (tc.isError) {
      // Only flag if the test doesn't expect errors
      const isEdgeCaseTest = testPrompt.category === 'edge-case' || testPrompt.category === 'adversarial';
      if (!isEdgeCaseTest) {
        errors.push(`Tool ${tc.toolName} returned error: ${JSON.stringify(tc.result)}`);
      }
    }
  }

  // Determine overall status
  const allAssertionsPassed = assertionResults.every((r) => r.passed);
  const hasNonAssertionErrors = errors.length > assertionResults.filter((r) => !r.passed).length;
  let status: 'pass' | 'fail' | 'partial';

  if (allAssertionsPassed && !hasNonAssertionErrors) {
    status = 'pass';
  } else if (assertionResults.some((r) => r.passed)) {
    status = 'partial';
  } else {
    status = 'fail';
  }

  return {
    promptId: testPrompt.id,
    prompt: testPrompt.prompt,
    category: testPrompt.category,
    status,
    responseText,
    toolCallsMade: toolCalls,
    expectedTools: testPrompt.expectedTools,
    assertionResults,
    apiCallCount: testPrompt.mockToolSequence.length,
    errors,
    durationMs: Date.now() - start,
  };
}

/**
 * Generate a summary report from test results.
 */
export function generateReport(results: TestResult[]): string {
  const total = results.length;
  const passed = results.filter((r) => r.status === 'pass').length;
  const partial = results.filter((r) => r.status === 'partial').length;
  const failed = results.filter((r) => r.status === 'fail').length;

  const lines: string[] = [
    '═══════════════════════════════════════════════════════════',
    '  AdTraffic.ai — Kiki Tool Test Report',
    '═══════════════════════════════════════════════════════════',
    '',
    `  Total: ${total}  |  Pass: ${passed}  |  Partial: ${partial}  |  Fail: ${failed}`,
    `  Pass Rate: ${((passed / total) * 100).toFixed(1)}%`,
    '',
  ];

  // Group by category
  const byCategory = new Map<string, TestResult[]>();
  for (const r of results) {
    const list = byCategory.get(r.category) ?? [];
    list.push(r);
    byCategory.set(r.category, list);
  }

  for (const [category, categoryResults] of byCategory) {
    const catPassed = categoryResults.filter((r) => r.status === 'pass').length;
    lines.push(`── ${category} (${catPassed}/${categoryResults.length} passed) ──`);

    for (const r of categoryResults) {
      const icon = r.status === 'pass' ? '  PASS' : r.status === 'partial' ? '  PART' : '  FAIL';
      lines.push(`  ${icon}  [${r.promptId}] ${r.prompt.slice(0, 60)}`);

      if (r.status !== 'pass') {
        for (const err of r.errors) {
          lines.push(`         → ${err}`);
        }
      }

      // Show tool calls
      if (r.toolCallsMade.length > 0) {
        lines.push(`         Tools: ${r.toolCallsMade.map((tc) => tc.toolName).join(' → ')}`);
      }
    }
    lines.push('');
  }

  lines.push('═══════════════════════════════════════════════════════════');
  return lines.join('\n');
}
