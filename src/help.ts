export const HELP = `sheet-metal-bend — flat-pattern calculator for sheet-metal bends

Usage:
  sheet-metal-bend --t <T> --r <R> --angle <A> --legs <L1,L2> [--k <K>] [--material <name>] [--json]
  sheet-metal-bend --t <T> --legs <L1,L2,...> --bend <A:R[:K]> [--bend <A:R[:K]>] [--k <K>] [--json]
  sheet-metal-bend --spec <file.json> [--k <K>] [--t <T>] [--json]

Formulas (A in degrees; T, R, and legs in one consistent length unit):
  BA = (π/180)·A·(R + K·T)
  OSSB = tan(A/2)·(R+T)
  BD = 2·OSSB − BA
  flat length = sum of outside leg lengths − BD per bend

Outside legs are measured to the mold line (virtual sharp). A part with N bends
needs N+1 legs.

Options:
  --t, --thickness <T>     Sheet thickness T > 0
  --r, --radius <R>        Inside bend radius R >= 0 for a single bend
  --angle <deg>            Bend angle in degrees, 0 < A < 180, for a single bend
  --k, --k-factor <K>      K-factor override, 0 < K <= 1 (replaces the built-in table)
  --material <name>        steel, aluminium (aluminum), or stainless (default: steel)
  --legs <L1,L2,...>       Outside leg lengths, comma-separated
  --bend <A:R[:K]>         One bend. Repeat for each extra bend. Optional per-bend K
  --spec <file.json>       Part JSON. Command-line flags override fields in the file
  --json                   Print JSON instead of text
  -h, --help               Show this help
  --version                Show version

K-factor:
  With no --k, K comes from the built-in air-bend table for the material and the
  R/T ratio. --k overrides that table. A K on one bend (--bend A:R:K, or k in
  the spec) overrides both the table and --k for that bend only.

Exit status:
  0  result, help, or version
  1  invalid input, unknown option, or unreadable spec

Examples:
  sheet-metal-bend --t 2 --r 2 --angle 90 --k 0.33 --legs 50,30
  sheet-metal-bend --t 2 --material aluminium --legs 50,30,20 --bend 90:2 --bend 45:1
  sheet-metal-bend --spec examples/bracket.json --json
`;
