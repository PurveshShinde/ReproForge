import os

file_path = r"d:\Repo\ReproForge\backend\src\services\sourceResolver.ts"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# We want to inject two new heuristics in findBugInFunction before the "any return-with-operator line"
anchor = "  // ── Heuristic: any return-with-operator line ───────────────────────────────"
injection = """
  // ── Heuristic: Missing properties (undefined actual) ───────────────────────
  if (ctx.actual === 'undefined' && ctx.expected !== undefined) {
    for (const { idx, text } of bodyLines) {
      if (/\\b(?:delete|remove)\\b/.test(text)) {
        return { line: idx + 1, lineContent: text, reason: `Suspicious property removal found: \\`${text.trim()}\\`` };
      }
    }
  }

  // ── Heuristic: Routing mismatch (404 actual, 200 expected) ─────────────────
  if (ctx.actual === '404' && ctx.expected === '200') {
    for (const { idx, text } of bodyLines) {
      if (/\\b(?:req\\.path|url|targetService)\\b/.test(text) && /['"]/.test(text)) {
        return { line: idx + 1, lineContent: text, reason: `Suspicious routing logic found: \\`${text.trim()}\\`` };
      }
    }
  }

"""

if anchor in content:
    content = content.replace(anchor, injection + anchor)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Injected heuristics successfully")
else:
    print("Could not find anchor")
