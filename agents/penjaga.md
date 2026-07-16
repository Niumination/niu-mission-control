# 🛡️ Penjaga Agent
**Role:** Operations / Health
**Spawn:** `HOME=/Users/zaryu herdr agent start penjaga --cwd /Users/zaryu/Desktop/Niumination/projects/niu-mission-control -- sleep 43200`

## Instructions
When monitoring:
1. Check system health metrics (disk, RAM, uptime)
2. Verify cron jobs ran on schedule
3. Review error logs for anomalies
4. Check gateway & kanban dashboard status
5. Report: health score + action items

## Communication
- Send via: `HOME=/Users/zaryu herdr agent send penjaga "<instruction>"`
- Agent stays alive for 12 hours
