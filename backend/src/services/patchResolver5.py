import os

file_path = r"d:\Repo\ReproForge\backend\src\services\sourceResolver.ts"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace operator heuristics to remove \breturn\b.* requirement, since operators can be assigned to variables!
content = content.replace(
    r"if (/\breturn\b.*\*/.test(text)",
    r"if (/\*/.test(text)"
)

content = content.replace(
    r"if (/\breturn\b.*\+/.test(text)",
    r"if (/\+/.test(text)"
)

content = content.replace(
    r"if (/\breturn\b.*-/.test(text)",
    r"if (/-/.test(text)"
)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Regex patched successfully")
