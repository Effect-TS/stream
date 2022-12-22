---
title: GroupBy.ts
nav_order: 9
parent: Modules
---

## GroupBy overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [constructors](#constructors)
  - [make](#make)
- [destructors](#destructors)
  - [evaluate](#evaluate)
- [models](#models)
  - [GroupBy (interface)](#groupby-interface)
- [mutations](#mutations)
  - [filter](#filter)
  - [first](#first)
- [symbols](#symbols)
  - [GroupByTypeId](#groupbytypeid)
  - [GroupByTypeId (type alias)](#groupbytypeid-type-alias)

---

# constructors

## make

Constructs a `GroupBy` from a `Stream`.

**Signature**

```ts
export declare const make: <R, E, K, V>(grouped: any) => GroupBy<R, E, K, V>
```

Added in v1.0.0

# destructors

## evaluate

Run the function across all groups, collecting the results in an
arbitrary order.

**Signature**

```ts
export declare const evaluate: <K, E, V, R2, E2, A>(
  f: (key: K, stream: any) => any,
  bufferSize?: number | undefined
) => <R>(self: GroupBy<R, E, K, V>) => any
```

Added in v1.0.0

# models

## GroupBy (interface)

Representation of a grouped stream. This allows to filter which groups will
be processed. Once this is applied all groups will be processed in parallel
and the results will be merged in arbitrary order.

**Signature**

```ts
export interface GroupBy<R, E, K, V> extends GroupBy.Variance<R, E, K, V> {
  readonly grouped: Stream.Stream<R, E, readonly [K, Queue.Dequeue<Take.Take<E, V>>]>
}
```

Added in v1.0.0

# mutations

## filter

Filter the groups to be processed.

**Signature**

```ts
export declare const filter: <K>(predicate: Predicate<K>) => <R, E, V>(self: GroupBy<R, E, K, V>) => GroupBy<R, E, K, V>
```

Added in v1.0.0

## first

Only consider the first `n` groups found in the `Stream`.

**Signature**

```ts
export declare const first: (n: number) => <R, E, K, V>(self: GroupBy<R, E, K, V>) => GroupBy<R, E, K, V>
```

Added in v1.0.0

# symbols

## GroupByTypeId

**Signature**

```ts
export declare const GroupByTypeId: typeof GroupByTypeId
```

Added in v1.0.0

## GroupByTypeId (type alias)

**Signature**

```ts
export type GroupByTypeId = typeof GroupByTypeId
```

Added in v1.0.0
