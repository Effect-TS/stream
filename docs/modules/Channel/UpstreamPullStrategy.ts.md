---
title: Channel/UpstreamPullStrategy.ts
nav_order: 8
parent: Modules
---

## UpstreamPullStrategy overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [constructors](#constructors)
  - [PullAfterAllEnqueued](#pullafterallenqueued)
  - [PullAfterNext](#pullafternext)
- [folding](#folding)
  - [match](#match)
- [models](#models)
  - [PullAfterAllEnqueued (interface)](#pullafterallenqueued-interface)
  - [PullAfterNext (interface)](#pullafternext-interface)
  - [UpstreamPullStrategy (type alias)](#upstreampullstrategy-type-alias)
- [refinements](#refinements)
  - [isPullAfterAllEnqueued](#ispullafterallenqueued)
  - [isPullAfterNext](#ispullafternext)
  - [isUpstreamPullStrategy](#isupstreampullstrategy)
- [symbols](#symbols)
  - [UpstreamPullStrategyTypeId](#upstreampullstrategytypeid)
  - [UpstreamPullStrategyTypeId (type alias)](#upstreampullstrategytypeid-type-alias)

---

# constructors

## PullAfterAllEnqueued

**Signature**

```ts
export declare const PullAfterAllEnqueued: <A>(emitSeparator: Option.Option<A>) => UpstreamPullStrategy<A>
```

Added in v1.0.0

## PullAfterNext

**Signature**

```ts
export declare const PullAfterNext: <A>(emitSeparator: Option.Option<A>) => UpstreamPullStrategy<A>
```

Added in v1.0.0

# folding

## match

Folds an `UpstreamPullStrategy<A>` into a value of type `Z`.

**Signature**

```ts
export declare const match: {
  <A, Z>(
    onPullAfterNext: (emitSeparator: Option.Option<A>) => Z,
    onPullAfterAllEnqueued: (emitSeparator: Option.Option<A>) => Z
  ): (self: UpstreamPullStrategy<A>) => Z
  <A, Z>(
    self: UpstreamPullStrategy<A>,
    onPullAfterNext: (emitSeparator: Option.Option<A>) => Z,
    onPullAfterAllEnqueued: (emitSeparator: Option.Option<A>) => Z
  ): Z
}
```

Added in v1.0.0

# models

## PullAfterAllEnqueued (interface)

**Signature**

```ts
export interface PullAfterAllEnqueued<A> extends UpstreamPullStrategy.Variance<A> {
  readonly _tag: 'PullAfterAllEnqueued'
  readonly emitSeparator: Option.Option<A>
}
```

Added in v1.0.0

## PullAfterNext (interface)

**Signature**

```ts
export interface PullAfterNext<A> extends UpstreamPullStrategy.Variance<A> {
  readonly _tag: 'PullAfterNext'
  readonly emitSeparator: Option.Option<A>
}
```

Added in v1.0.0

## UpstreamPullStrategy (type alias)

**Signature**

```ts
export type UpstreamPullStrategy<A> = PullAfterNext<A> | PullAfterAllEnqueued<A>
```

Added in v1.0.0

# refinements

## isPullAfterAllEnqueued

Returns `true` if the specified `UpstreamPullStrategy` is a
`PullAfterAllEnqueued`, `false` otherwise.

**Signature**

```ts
export declare const isPullAfterAllEnqueued: <A>(self: UpstreamPullStrategy<A>) => self is PullAfterAllEnqueued<A>
```

Added in v1.0.0

## isPullAfterNext

Returns `true` if the specified `UpstreamPullStrategy` is a `PullAfterNext`,
`false` otherwise.

**Signature**

```ts
export declare const isPullAfterNext: <A>(self: UpstreamPullStrategy<A>) => self is PullAfterNext<A>
```

Added in v1.0.0

## isUpstreamPullStrategy

Returns `true` if the specified value is an `UpstreamPullStrategy`, `false`
otherwise.

**Signature**

```ts
export declare const isUpstreamPullStrategy: (u: unknown) => u is UpstreamPullStrategy<unknown>
```

Added in v1.0.0

# symbols

## UpstreamPullStrategyTypeId

**Signature**

```ts
export declare const UpstreamPullStrategyTypeId: typeof UpstreamPullStrategyTypeId
```

Added in v1.0.0

## UpstreamPullStrategyTypeId (type alias)

**Signature**

```ts
export type UpstreamPullStrategyTypeId = typeof UpstreamPullStrategyTypeId
```

Added in v1.0.0
