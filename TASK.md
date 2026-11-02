# Task: sheet-metal-bend (Node.js + TypeScript CLI, no network)
Goal: sheet-metal flat-pattern calculator for CAD/machining freelancers and students.
- Command: `sheet-metal-bend --t 2 --r 2 --angle 90 --k 0.33 --legs 50,30` prints bend allowance BA = (π/180)·A·(R + K·T), outside setback OSSB = tan(A/2)·(R+T), bend deduction BD = 2·OSSB − BA, and flat length = sum of outside leg lengths − BD per bend. Support multiple bends via repeated `--bend angle:radius` or a JSON spec file (`--spec part.json`). `--json` output.
- Built-in default K-factor table (material steel/aluminium/stainless by R/T ratio) with source comments; `--k` overrides. Validate inputs (t>0, r>=0, 0<angle<180) with clear errors and non-zero exit.
- Unit tests with hand-computed reference values: T=2, R=2, A=90, K=0.33 → BA≈4.18, OSSB=4.00, BD≈3.82; legs 50+30 → flat≈76.18. `npm test` must pass.
- README in English plus short Chinese section, MIT LICENSE, .gitignore with node_modules, dist, *.log. No personal data or local absolute paths.
