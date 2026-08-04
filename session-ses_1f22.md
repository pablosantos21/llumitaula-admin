# Install Superpowers per .opencode/INSTALL.md

**Session ID:** ses_1f222826fffeRjdd0wtvjL3yNF
**Created:** 5/9/2026, 7:51:19 PM
**Updated:** 5/9/2026, 7:51:54 PM

---

## User

Fetch and follow instructions from https://raw.githubusercontent.com/obra/superpowers/refs/heads/main/.opencode/INSTALL.md

---

## Assistant (Build · GPT-4o · 2.6s)

**Tool: webfetch**

**Input:**
```json
{
  "url": "https://raw.githubusercontent.com/obra/superpowers/refs/heads/main/.opencode/INSTALL.md",
  "format": "markdown"
}
```

**Output:**
```
# Installing Superpowers for OpenCode

## Prerequisites

- [OpenCode.ai](https://opencode.ai) installed

## Installation

Add superpowers to the `plugin` array in your `opencode.json` (global or project-level):

```json
{
  "plugin": ["superpowers@git+https://github.com/obra/superpowers.git"]
}
```

Restart OpenCode. The plugin installs through OpenCode's plugin manager and
registers all skills.

Verify by asking: "Tell me about your superpowers"

OpenCode uses its own plugin install. If you also use Claude Code, Codex, or
another harness, install Superpowers separately for each one.

## Migrating from the old symlink-based install

If you previously installed superpowers using `git clone` and symlinks, remove the old setup:

```bash
# Remove old symlinks
rm -f ~/.config/opencode/plugins/superpowers.js
rm -rf ~/.config/opencode/skills/superpowers

# Optionally remove the cloned repo
rm -rf ~/.config/opencode/superpowers

# Remove skills.paths from opencode.json if you added one for superpowers
```

Then follow the installation steps above.

## Usage

Use OpenCode's native `skill` tool:

```
use skill tool to list skills
use skill tool to load superpowers/brainstorming
```

## Updating

OpenCode installs Superpowers through a git-backed package spec. Some OpenCode
and Bun versions pin that resolved git dependency in a lockfile or cache, so a
restart may not pick up the newest Superpowers commit. If updates do not appear,
clear OpenCode's package cache or reinstall the plugin.

To pin a specific version:

```json
{
  "plugin": ["superpowers@git+https://github.com/obra/superpowers.git#v5.0.3"]
}
```

## Troubleshooting

### Plugin not loading

1. Check logs: `opencode run --print-logs "hello" 2>&1 | grep -i superpowers`
2. Verify the plugin line in your `opencode.json`
3. Make sure you're running a recent version of OpenCode

### Windows install issues

Some Windows OpenCode builds have upstream installer issues with git-backed
plugin specs, including cache paths for `git+https` URLs and Bun not finding
`git.exe` even when it works in a normal terminal. If OpenCode cannot install
the plugin, try installing with system npm and pointing OpenCode at the local
package:

```powershell
npm install superpowers@git+https://github.com/obra/superpowers.git --prefix "$HOME\.config\opencode"
```

Then use the installed package path in `opencode.json`:

```json
{
  "plugin": ["~/.config/opencode/node_modules/superpowers"]
}
```

### Skills not found

1. Use `skill` tool to list what's discovered
2. Check that the plugin is loading (see above)

### Tool mapping

When skills reference Claude Code tools:
- `TodoWrite` → `todowrite`
- `Task` with subagents → `@mention` syntax
- `Skill` tool → OpenCode's native `skill` tool
- File operations → your native tools

## Getting Help

- Report issues: https://github.com/obra/superpowers/issues
- Full documentation: https://github.com/obra/superpowers/blob/main/docs/README.opencode.md

```

---

## Assistant (Build · GPT-4o · 5.0s)

Here are the instructions retrieved from the given URL, summarized and ready to follow:

---

### **Installation Steps**

1. **Ensure Prerequisites**
   - OpenCode.ai needs to be installed.

2. **Add Superpowers Plugin**
   - Add the plugin to the `opencode.json` file (either globally or project-level):
     ```json
     {
       "plugin": ["superpowers@git+https://github.com/obra/superpowers.git"]
     }
     ```

3. **Restart OpenCode**
   - Restart your OpenCode environment to install Superpowers via the plugin manager.

4. **Verify the Installation**
   - Once restarted, ask OpenCode to confirm:
     ```plaintext
     "Tell me about your superpowers"
     ```

#### **Migrating from Old Install**
If you had previously installed Superpowers using symlinks, cleanup is required before installing the new version:
```bash
rm -f ~/.config/opencode/plugins/superpowers.js
rm -rf ~/.config/opencode/skills/superpowers
rm -rf ~/.config/opencode/superpowers
```
If `skills.paths` is in `opencode.json`, remove it as well.

---

### **Additional Notes**

- **Usage:** Use OpenCode's `skill` tool to explore and load Superpowers skills.
- **Updating:** Restart OpenCode to update, and clear the package cache if updates don't apply.
- **Troubleshooting:** Address plugin issues using commands or checks (steps listed in the URL).

---

Would you like me to proceed with configuring this in the current project or help with a specific step (e.g., adding the plugin, verifying installation)? Let me know how you’d like to handle it!

---

## User

yes

---

## Assistant (Build · GPT-4o · 1.7s)

**Tool: read**

**Input:**
```json
{
  "filePath": "/Users/pabs/Projects/llumitaula-admin/opencode.json"
}
```

**Error:**
```
File not found: /Users/pabs/Projects/llumitaula-admin/opencode.json
```

---

## Assistant (Build · GPT-4o · 1.9s)

**Tool: write**

**Input:**
```json
{
  "filePath": "/Users/pabs/Projects/llumitaula-admin/opencode.json",
  "content": "{\n  \"plugin\": [\"superpowers@git+https://github.com/obra/superpowers.git\"]\n}"
}
```

**Output:**
```
Wrote file successfully.
```

---

## Assistant (Build · GPT-4o · 1.7s)

**Tool: bash**

**Input:**
```json
{
  "command": "opencode restart",
  "description": "Restarting OpenCode to apply the changes"
}
```

**Output:**
```
[91m[1mError: [0mFailed to change directory to /Users/pabs/Projects/llumitaula-admin/restart

```

---

## Assistant (Build · GPT-4o · 2.7s)

It seems that the `opencode restart` command does not directly apply in this context or is not recognized properly in your setup. You may need to manually restart OpenCode if it is running.

### Manual Steps to Finalize Installation:
1. Restart your OpenCode environment (manually or using the appropriate command for your setup).
2. After restarting, verify the installation by asking OpenCode:
   ```plaintext
   Tell me about your superpowers
   ```

Let me know if you’d like additional help or adjustments!

---

