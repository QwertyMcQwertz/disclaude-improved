# Roadmap

Features are grouped into tiers by theme, not strict implementation order. Items may ship in parallel, out of order, or via community PRs.

## Planned

### Tier 0: Quick Wins

- **User context in prompts** — Claude knows who's talking (username, channel) for more relevant responses
- **Log sensitivity split** — Sanitized logs safe to share publicly, detailed logs kept private
- **Simpler tmux session names** — Easier to attach manually (e.g., `disco_research` instead of long IDs)
- **Message debouncing** — Rapid consecutive messages batched into a single Claude turn

### Tier 1: Infrastructure

- **Hooks over polling** — Use Claude Code's native hook system for instant completion detection
- **Session restoration** — Restore Claude sessions after accidental channel deletion

### Tier 2: Observability

- **Rich status embeds** — Visual dashboard showing all agents with live status indicators

### Tier 3: Multi-Agent Foundation

- **Agent registry & task queue** — File-based coordination layer for multiple agents
- **Agent messaging** — Claude-to-Claude communication across channels

### Tier 4: Multi-Agent Advanced

- **Autonomous operation** — Agents self-claim tasks, check inboxes, work without constant user input
- **Production polish** — Rich Discord UI, button interactions, error handling, archiving

### Tier 5: Automation

- **Scheduled tasks** — Spawn agents on cron schedules, send notifications via ntfy

### Tier 6: Big Picture

- **Web dashboard** — Real-time web interface for agents, tasks, and system health

## Completed

*Features that shipped in v1.0 and v1.1 form the baseline.*
