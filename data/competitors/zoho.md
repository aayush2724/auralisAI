# Zoho CRM

## Weaknesses
- Interface complexity: Zoho's breadth (40+ apps) creates a fragmented, inconsistent UX that overwhelms new users.
- AI features (Zia) are basic: intent detection is rule-based and lacks the NLP depth of purpose-built conversation AI.
- Data quality issues: duplicate record management is weak; large-scale cleanups are manual and time-consuming.
- Support quality: community-first support model means critical issues can take 24–72 hours to resolve on paid plans.
- Customisation is powerful but brittle: heavy custom modules often break after platform updates.
- Reporting requires Zoho Analytics (a separate product, separate cost) for anything beyond basic dashboards.
- Perception problem: frequently positioned as "cheap Salesforce" — prospects in enterprise deals may push back on brand credibility.

## Our Advantages vs Zoho CRM
- **Purpose-built for sales coaching**: Zoho Zia provides basic AI suggestions; Auralis provides real-time objection classification, sentiment detection, persona recognition, and adaptive strategy selection — all in one inference loop.
- **Reliability**: Auralis uptime SLA is 99.9% with dedicated infrastructure; Zoho has had several high-profile outages affecting all 40+ apps simultaneously.
- **Cleaner UX**: Auralis is built around a single workflow — the conversation — rather than a suite of disconnected apps.
- **Knowledge base RAG**: cited proof points surfaced mid-call; Zoho has no equivalent capability.
- **Transparent pricing**: no per-module billing, no surprise add-ons.

## Pricing Comparison
| Plan       | Zoho CRM             | Auralis              |
|------------|----------------------|----------------------|
| Free       | Up to 3 users        | 14-day trial         |
| Standard   | $14/seat/mo          | $99/mo (5 seats)     |
| Professional | $23/seat/mo        | $399/mo (20 seats)   |
| Enterprise | $40/seat/mo          | Custom               |
| Ultimate   | $52/seat/mo          | Custom               |

*Zoho pricing Q1 2024. Does not include Zoho Analytics, Zoho Campaigns, or other add-on apps.*

## Integration Story
- Zoho CRM → Auralis: standard CSV export from Zoho Contacts and Leads modules.
- Zoho's REST API can also be used for programmatic migration of up to 200k records.
- Auralis provides field-mapping templates specifically for Zoho schema.
- Parallel operation: Auralis can write call summaries and objection data back to Zoho CRM via webhook integration.
- Zoho-to-Auralis migrations typically complete within 3 hours for standard deployments.
