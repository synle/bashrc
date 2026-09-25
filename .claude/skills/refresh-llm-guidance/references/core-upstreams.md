# Core Upstreams

Read every row when a refresh request names `core` or `default`. Focus paths guide initial reads; inspect adjacent source files when needed to understand a semantic change.

| Repository                                             | Focus paths                                                             | Local concern                                                                        |
| ------------------------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `https://github.com/DietrichGebert/ponytail`           | `AGENTS.md`, `examples/`, `skills/`                                     | minimal implementation and review discipline                                         |
| `https://github.com/juliusbrussee/caveman`             | `README.md`, `skills/`                                                  | concise communication persona                                                        |
| `https://github.com/multica-ai/andrej-karpathy-skills` | `CLAUDE.md`, `skills/karpathy-guidelines/SKILL.md`, `EXAMPLES.md`       | assumptions, simplicity, surgical edits, and observable completion                   |
| `https://github.com/khasky/awesome-agent-skills`       | `skills/awesome-{bug-fix,code-review,test-writing,regression-sweep}/`   | verification-first debugging, review, testing, and quality gates                     |
| `https://github.com/arjunprabhulal/agent-skills`       | `skills/{diagnose,review,qa,security,sre,devops,docs,agent-lifecycle}/` | broad engineering and agent-lifecycle procedures                                     |
| `https://github.com/OthmanAdi/planning-with-files`     | `.pi/skills/planning-with-files/`, `CHANGELOG.md`                       | durable planning, context recovery, and completion gates without adopting its layout |

Resolve current default branch and HEAD every run. Never pin this registry to prior refresh SHAs.
