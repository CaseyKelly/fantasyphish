#!/usr/bin/env node
// Reads Playwright's JSON reporter output (see playwright.config.ts) and
// writes a markdown PR comment body summarizing pass/fail/flaky counts plus
// a table of failing/flaky tests, so reviewers see results without opening
// the Actions run. Consumed by e2e-tests.yml via peter-evans/find-comment +
// peter-evans/create-or-update-comment.
import { readFileSync, writeFileSync } from "node:fs"

const REPORT_PATH = "playwright-report/report.json"
const OUTPUT_PATH = "playwright-report/pr-comment.md"

const report = JSON.parse(readFileSync(REPORT_PATH, "utf8"))
const {
  expected = 0,
  unexpected = 0,
  flaky = 0,
  skipped = 0,
} = report.stats ?? {}
const total = expected + unexpected + flaky + skipped

function collectSpecs(suites, out) {
  for (const suite of suites ?? []) {
    out.push(...(suite.specs ?? []))
    collectSpecs(suite.suites, out)
  }
}

const specs = []
collectSpecs(report.suites, specs)

const notable = specs.filter((spec) => {
  const status = spec.tests?.[0]?.status
  return status === "unexpected" || status === "flaky"
})

const lines = []
lines.push("<!-- playwright-report-comment -->")
lines.push("### \u{1F3AD} Playwright test results")
lines.push("")
lines.push(
  `${unexpected > 0 ? "❌" : "✅"} **${expected} passed**, **${unexpected} failed**, **${flaky} flaky**, **${skipped} skipped** (${total} total)`
)

if (notable.length > 0) {
  lines.push("")
  lines.push("| Status | Test | Location |")
  lines.push("| --- | --- | --- |")
  for (const spec of notable) {
    const status = spec.tests[0].status
    const icon = status === "unexpected" ? "❌" : "⚠️"
    const label = status === "unexpected" ? "Failed" : "Flaky"
    lines.push(
      `| ${icon} ${label} | ${spec.title} | \`${spec.file}:${spec.line}\` |`
    )
  }
}

const runUrl = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
lines.push("")
lines.push(
  `Full HTML report with traces, screenshots, and console logs: download the \`playwright-results\` artifact from [this run](${runUrl}) and open it with \`npx playwright show-report\` (or \`npm run test:trace\` locally).`
)

writeFileSync(OUTPUT_PATH, lines.join("\n") + "\n")
console.log(
  `Wrote PR comment body to ${OUTPUT_PATH} (${notable.length} notable test(s) of ${total} total)`
)
