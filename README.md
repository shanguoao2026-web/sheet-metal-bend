# sheet-metal-bend

Command-line flat-pattern calculator for sheet-metal bends. It is aimed at CAD and machining freelancers and at students who need bend allowance, outside setback, bend deduction, and flat length from thickness, inside radius, bend angle, and a K-factor.

Lengths are whatever unit you use for thickness, radius, and legs together. Millimetres are the usual choice. The angle is the bend angle in degrees: how far the sheet turns. A right-angle bracket is 90 degrees. Outside legs are measured to the mold line (the virtual sharp), not to the tangent of the bend.

## Formulas

```
BA = (π/180)·A·(R + K·T)
OSSB = tan(A/2)·(R+T)
BD = 2·OSSB − BA
flat length = sum of outside leg lengths − BD per bend
```

- `BA` is the bend allowance, the neutral-axis arc length through the bend.
- `OSSB` is the outside setback, from the mold-line corner to the start of the bend.
- `BD` is the bend deduction subtracted once per bend.
- `T` is thickness, `R` is the inside radius, `A` is the bend angle in degrees, and `K` is the neutral-axis position as a fraction of thickness, measured from the inside face.

For one bend this is the same as `(L1 − OSSB) + BA + (L2 − OSSB)`. A part with N bends needs N+1 outside legs.

Worked example: `T = 2`, `R = 2`, `A = 90`, `K = 0.33`, legs `50` and `30`.

| Quantity | Value |
| --- | --- |
| BA | 4.1783 (about 4.18) |
| OSSB | 4.0000 |
| BD | 3.8217 (about 3.82) |
| Flat length | 76.1783 (about 76.18) |

These are planning numbers. A test coupon on the real tool and material is still the right way to lock a production K-factor.

## Install and run

```bash
npm install
npm run build
node dist/cli.js --t 2 --r 2 --angle 90 --k 0.33 --legs 50,30
```

After install, the package binary name is `sheet-metal-bend` (it points at `dist/cli.js`).

```bash
sheet-metal-bend --t 2 --r 2 --angle 90 --k 0.33 --legs 50,30
sheet-metal-bend --spec examples/bracket.json --json
```

`--json` prints the same result as JSON on stdout. Invalid input prints `Error: ...` on stderr and exits with status 1.

## Options

| Option | Meaning |
| --- | --- |
| `--t`, `--thickness <T>` | Sheet thickness. Must be greater than 0. |
| `--r`, `--radius <R>` | Inside radius for a single bend. Must be greater than or equal to 0. |
| `--angle <deg>` | Bend angle in degrees for a single bend. Must be greater than 0 and less than 180. |
| `--k`, `--k-factor <K>` | K-factor override, greater than 0 and at most 1. Replaces the built-in table. |
| `--material <name>` | `steel` (default), `aluminium` / `aluminum`, or `stainless` / `stainless steel`. |
| `--legs <L1,L2,...>` | Outside leg lengths, comma-separated. One more value than the number of bends. |
| `--bend <A:R[:K]>` | One bend. Repeat the flag for each extra bend. The optional third field is a per-bend K. |
| `--spec <file.json>` | Read a part from JSON. Command-line flags override the file. |
| `--json` | Machine-readable JSON on stdout. |
| `-h`, `--help` | Help text. |
| `--version` | Version string. |

Do not combine `--bend` with `--angle` / `--r`. Each of those forms describes the bends by itself.

K-factor precedence, highest first:

1. Per-bend K (`--bend 90:2:0.42`, or `"k"` / `"kFactor"` on a bend in the spec).
2. `--k` on the command line.
3. Top-level `"k"` or `"kFactor"` in the spec.
4. Built-in table for the material and that bend's R/T.

## K-factor table

Air-bend starting values. `--k` replaces the whole table. The source and the boundary rule are commented in `src/kfactor.ts`: the air-bending chart commonly reproduced from Machinery's Handbook practice (soft / medium / hard), with soft mapped to aluminium, medium to steel, and hard to stainless.

| R/T | Aluminium | Steel | Stainless |
| --- | --- | --- | --- |
| ≤ 1 (includes R = 0 and R = T) | 0.33 | 0.38 | 0.40 |
| > 1 and ≤ 3 (includes R = 3T) | 0.40 | 0.43 | 0.45 |
| > 3 | 0.50 | 0.50 | 0.50 |

Aluminium at R/T = 1 is K = 0.33, so the worked example above is also what you get from `--material aluminium` with no `--k`.

## Several bends

```bash
node dist/cli.js --t 2 --legs 50,30,20 --bend 90:2 --bend 45:1 --k 0.33
```

Each `--bend` is `angle:radius` or `angle:radius:k`. Leg order follows the part: first outside flange, then each segment between bends, then the last flange.

## JSON spec

`examples/bracket.json` and `examples/channel.json` are complete parts. Recognized fields:

```json
{
  "thickness": 2,
  "material": "steel",
  "kFactor": 0.33,
  "legs": [50, 30, 40],
  "bends": [
    { "angle": 90, "radius": 2 },
    { "angle": 45, "radius": 3, "kFactor": 0.4 }
  ]
}
```

Short names also work: `t`, `k`, `r`, and a single bend written as top-level `angle` plus `radius` (or `r`) when there is no `bends` array. `legs` may be a comma-separated string. Extra fields such as `name` and `notes` are ignored.

```bash
node dist/cli.js --spec examples/bracket.json
node dist/cli.js --spec examples/channel.json --json
```

JSON numbers are rounded to 6 decimal places, and each bend's deduction is reported so that `BD = 2·OSSB − BA` still holds at that precision. Text output uses 4 decimal places.

## Validation

The program refuses to calculate when:

- thickness is missing, not finite, or not greater than 0
- a radius is missing, not finite, or negative
- an angle is missing, not finite, or not strictly between 0 and 180 degrees
- a K-factor is not finite, not greater than 0, or greater than 1
- the material name is not steel, aluminium/aluminum, or stainless
- the leg count is not exactly one more than the bend count, or a leg is not greater than 0
- the spec file is missing, unreadable, or not a JSON object

The message names the bad field and the value it saw. The exit status is 1. Help and a successful result exit 0.

## Tests

```bash
npm test
```

`npm test` compiles the CLI and the TypeScript tests, then runs them with `node --test`. The reference case (T = 2, R = 2, A = 90, K = 0.33, legs 50 and 30) is checked against the hand-computed values BA ≈ 4.18, OSSB = 4.00, BD ≈ 3.82, and flat length ≈ 76.18.

## License

MIT. See [LICENSE](LICENSE).

## 中文简介

`sheet-metal-bend` 是一个钣金展开长度命令行计算器，面向 CAD 与机加工中的展开计算，也适合教学。

在同一长度单位下给定板厚 T、内弯曲半径 R、折弯角 A（度，材料转过的角度）和 K 因子后，程序计算：

- 弯曲余量 BA = (π/180)·A·(R + K·T)
- 外退距 OSSB = tan(A/2)·(R+T)
- 弯曲扣除 BD = 2·OSSB − BA
- 展开长度 = 各段外尺寸之和 − 每个折弯的 BD

外尺寸量到模具线（虚拟交点）。N 个折弯需要 N+1 段外尺寸。

内置钢材、铝材、不锈钢的气弯 K 因子表，按 R/T 分段取值；`--k` 会覆盖整张表，单个折弯上的 K 只覆盖该折弯。可用重复的 `--bend 角度:半径` 表示多折，或用 `--spec part.json` 读入零件。`--json` 输出 JSON。板厚必须大于 0，半径必须大于等于 0，折弯角必须大于 0 且小于 180 度；不合法输入会在标准错误输出说明并以状态码 1 退出。

参考例子：T=2，R=2，A=90，K=0.33，外尺寸 50 与 30，展开长度约为 76.18。

```bash
npm install
npm run build
npm test
node dist/cli.js --t 2 --r 2 --angle 90 --k 0.33 --legs 50,30
```
