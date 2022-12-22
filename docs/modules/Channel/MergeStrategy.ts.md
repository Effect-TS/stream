---
title: Channel/MergeStrategy.ts
nav_order: 5
parent: Modules
---

## MergeStrategy overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [constructors](#constructors)
  - [BackPressure](#backpressure)
  - [BufferSliding](#buffersliding)
- [folding](#folding)
  - [match](#match)
- [models](#models)
  - [BackPressure (interface)](#backpressure-interface)
  - [BufferSliding (interface)](#buffersliding-interface)
  - [MergeStrategy (type alias)](#mergestrategy-type-alias)
- [refinements](#refinements)
  - [isBackPressure](#isbackpressure)
  - [isBufferSliding](#isbuffersliding)
  - [isMergeStrategy](#ismergestrategy)
- [symbols](#symbols)
  - [MergeStrategyTypeId](#mergestrategytypeid)
  - [MergeStrategyTypeId (type alias)](#mergestrategytypeid-type-alias)

---

# constructors

## BackPressure

**Signature**

```ts
export declare const BackPressure: MergeStrategy
```

Added in v1.0.0

## BufferSliding

**Signature**

```ts
export declare const BufferSliding: MergeStrategy
```

Added in v1.0.0

# folding

## match

Folds an `MergeStrategy` into a value of type `A`.

**Signature**

```ts
export declare const match: <A>(onBackPressure: () => A, onBufferSliding: () => A) => (self: MergeStrategy) => A
```

Added in v1.0.0

# models

## BackPressure (interface)

**Signature**

```ts
export interface BackPressure extends MergeStrategy.Proto {
  readonly op: OpCodes.OP_BACK_PRESSURE
}
```

Added in v1.0.0

## BufferSliding (interface)

**Signature**

```ts
export interface BufferSliding extends MergeStrategy.Proto {
  readonly op: OpCodes.OP_BUFFER_SLIDING
}
```

Added in v1.0.0

## MergeStrategy (type alias)

**Signature**

```ts
export type MergeStrategy = BackPressure | BufferSliding
```

Added in v1.0.0

# refinements

## isBackPressure

Returns `true` if the specified `MergeStrategy` is a `BackPressure`, `false`
otherwise.

**Signature**

```ts
export declare const isBackPressure: (self: MergeStrategy) => self is BackPressure
```

Added in v1.0.0

## isBufferSliding

Returns `true` if the specified `MergeStrategy` is a `BufferSliding`, `false`
otherwise.

**Signature**

```ts
export declare const isBufferSliding: (self: MergeStrategy) => self is BufferSliding
```

Added in v1.0.0

## isMergeStrategy

Returns `true` if the specified value is a `MergeStrategy`, `false`
otherwise.

**Signature**

```ts
export declare const isMergeStrategy: (u: unknown) => u is MergeStrategy
```

Added in v1.0.0

# symbols

## MergeStrategyTypeId

**Signature**

```ts
export declare const MergeStrategyTypeId: typeof MergeStrategyTypeId
```

Added in v1.0.0

## MergeStrategyTypeId (type alias)

**Signature**

```ts
export type MergeStrategyTypeId = typeof MergeStrategyTypeId
```

Added in v1.0.0
