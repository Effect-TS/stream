---
title: STM.ts
nav_order: 1
parent: Modules
---

## STM overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [STM (interface)](#stm-interface)
  - [STMDieException (interface)](#stmdieexception-interface)
  - [STMDieExceptionTypeId](#stmdieexceptiontypeid)
  - [STMDieExceptionTypeId (type alias)](#stmdieexceptiontypeid-type-alias)
  - [STMFailException (interface)](#stmfailexception-interface)
  - [STMFailExceptionTypeId](#stmfailexceptiontypeid)
  - [STMFailExceptionTypeId (type alias)](#stmfailexceptiontypeid-type-alias)
  - [STMInterruptException (interface)](#stminterruptexception-interface)
  - [STMInterruptExceptionTypeId](#stminterruptexceptiontypeid)
  - [STMInterruptExceptionTypeId (type alias)](#stminterruptexceptiontypeid-type-alias)
  - [STMRetryException (interface)](#stmretryexception-interface)
  - [STMRetryExceptionTypeId](#stmretryexceptiontypeid)
  - [STMRetryExceptionTypeId (type alias)](#stmretryexceptiontypeid-type-alias)
  - [STMTypeId](#stmtypeid)
  - [STMTypeId (type alias)](#stmtypeid-type-alias)
  - [catchAll](#catchall)
  - [commit](#commit)
  - [die](#die)
  - [effect](#effect)
  - [ensuring](#ensuring)
  - [fail](#fail)
  - [flatMap](#flatmap)
  - [foldSTM](#foldstm)
  - [interrupt](#interrupt)
  - [isDieException](#isdieexception)
  - [isFailException](#isfailexception)
  - [isInterruptException](#isinterruptexception)
  - [isRetryException](#isretryexception)
  - [map](#map)
  - [orTry](#ortry)
  - [provideSomeEnvironment](#providesomeenvironment)
  - [retry](#retry)
  - [succeed](#succeed)
  - [sync](#sync)
  - [zip](#zip)
  - [zipLeft](#zipleft)
  - [zipRight](#zipright)
  - [zipWith](#zipwith)

---

# utils

## STM (interface)

**Signature**

```ts
export interface STM<R, E, A> extends STM.Variance<R, E, A>, Effect.Effect<R, E, A> {}
```

Added in v1.0.0

## STMDieException (interface)

**Signature**

```ts
export interface STMDieException {
  readonly [STMDieExceptionTypeId]: STMDieExceptionTypeId
  readonly defect: unknown
}
```

Added in v1.0.0

## STMDieExceptionTypeId

**Signature**

```ts
export declare const STMDieExceptionTypeId: typeof STMDieExceptionTypeId
```

Added in v1.0.0

## STMDieExceptionTypeId (type alias)

**Signature**

```ts
export type STMDieExceptionTypeId = typeof STMDieExceptionTypeId
```

Added in v1.0.0

## STMFailException (interface)

**Signature**

```ts
export interface STMFailException<E> {
  readonly [STMFailExceptionTypeId]: STMFailExceptionTypeId
  readonly error: E
}
```

Added in v1.0.0

## STMFailExceptionTypeId

**Signature**

```ts
export declare const STMFailExceptionTypeId: typeof STMFailExceptionTypeId
```

Added in v1.0.0

## STMFailExceptionTypeId (type alias)

**Signature**

```ts
export type STMFailExceptionTypeId = typeof STMFailExceptionTypeId
```

Added in v1.0.0

## STMInterruptException (interface)

**Signature**

```ts
export interface STMInterruptException {
  readonly [STMInterruptExceptionTypeId]: STMInterruptExceptionTypeId
  readonly fiberId: FiberId.FiberId
}
```

Added in v1.0.0

## STMInterruptExceptionTypeId

**Signature**

```ts
export declare const STMInterruptExceptionTypeId: typeof STMInterruptExceptionTypeId
```

Added in v1.0.0

## STMInterruptExceptionTypeId (type alias)

**Signature**

```ts
export type STMInterruptExceptionTypeId = typeof STMInterruptExceptionTypeId
```

Added in v1.0.0

## STMRetryException (interface)

**Signature**

```ts
export interface STMRetryException {
  readonly [STMRetryExceptionTypeId]: STMRetryExceptionTypeId
}
```

Added in v1.0.0

## STMRetryExceptionTypeId

**Signature**

```ts
export declare const STMRetryExceptionTypeId: typeof STMRetryExceptionTypeId
```

Added in v1.0.0

## STMRetryExceptionTypeId (type alias)

**Signature**

```ts
export type STMRetryExceptionTypeId = typeof STMRetryExceptionTypeId
```

Added in v1.0.0

## STMTypeId

**Signature**

```ts
export declare const STMTypeId: typeof STMTypeId
```

Added in v1.0.0

## STMTypeId (type alias)

**Signature**

```ts
export type STMTypeId = typeof STMTypeId
```

Added in v1.0.0

## catchAll

**Signature**

```ts
export declare const catchAll: <E, R1, E1, B>(
  f: (e: E) => STM<R1, E1, B>
) => <R, A>(self: STM<R, E, A>) => STM<R1 | R, E1, B | A>
```

Added in v1.0.0

## commit

**Signature**

```ts
export declare const commit: <R, E, A>(self: STM<R, E, A>) => Effect.Effect<R, E, A>
```

Added in v1.0.0

## die

**Signature**

```ts
export declare const die: (defect: unknown) => STM<never, never, never>
```

Added in v1.0.0

## effect

**Signature**

```ts
export declare const effect: typeof internal.effect
```

Added in v1.0.0

## ensuring

**Signature**

```ts
export declare const ensuring: <R1, B>(
  finalizer: STM<R1, never, B>
) => <R, E, A>(self: STM<R, E, A>) => STM<R1 | R, E, A>
```

Added in v1.0.0

## fail

**Signature**

```ts
export declare const fail: <E>(error: E) => STM<never, E, never>
```

Added in v1.0.0

## flatMap

**Signature**

```ts
export declare const flatMap: <A, R1, E1, A2>(
  f: (a: A) => STM<R1, E1, A2>
) => <R, E>(self: STM<R, E, A>) => STM<R1 | R, E1 | E, A2>
```

Added in v1.0.0

## foldSTM

**Signature**

```ts
export declare const foldSTM: <E, R1, E1, A1, A, R2, E2, A2>(
  onFailure: (e: E) => STM<R1, E1, A1>,
  onSuccess: (a: A) => STM<R2, E2, A2>
) => <R>(self: STM<R, E, A>) => STM<R1 | R2 | R, E1 | E2, A1 | A2>
```

Added in v1.0.0

## interrupt

**Signature**

```ts
export declare const interrupt: () => STM<never, never, never>
```

Added in v1.0.0

## isDieException

**Signature**

```ts
export declare const isDieException: (u: unknown) => u is STMDieException
```

Added in v1.0.0

## isFailException

**Signature**

```ts
export declare const isFailException: (u: unknown) => u is STMFailException<unknown>
```

Added in v1.0.0

## isInterruptException

**Signature**

```ts
export declare const isInterruptException: (u: unknown) => u is STMInterruptException
```

Added in v1.0.0

## isRetryException

**Signature**

```ts
export declare const isRetryException: (u: unknown) => u is internal.STMRetryException
```

Added in v1.0.0

## map

**Signature**

```ts
export declare const map: <A, B>(f: (a: A) => B) => <R, E>(self: STM<R, E, A>) => STM<R, E, B>
```

Added in v1.0.0

## orTry

**Signature**

```ts
export declare const orTry: <R1, E1, A1>(
  that: () => STM<R1, E1, A1>
) => <R, E, A>(self: STM<R, E, A>) => STM<R1 | R, E1 | E, A1 | A>
```

Added in v1.0.0

## provideSomeEnvironment

**Signature**

```ts
export declare const provideSomeEnvironment: <R0, R>(
  f: (context: Context.Context<R0>) => Context.Context<R>
) => <E, A>(self: STM<R, E, A>) => STM<R0, E, A>
```

Added in v1.0.0

## retry

**Signature**

```ts
export declare const retry: () => STM<never, never, never>
```

Added in v1.0.0

## succeed

**Signature**

```ts
export declare const succeed: <A>(value: A) => STM<never, never, A>
```

Added in v1.0.0

## sync

**Signature**

```ts
export declare const sync: <A>(evaluate: () => A) => STM<never, never, A>
```

Added in v1.0.0

## zip

**Signature**

```ts
export declare const zip: <R1, E1, A1>(
  that: STM<R1, E1, A1>
) => <R, E, A>(self: STM<R, E, A>) => STM<R1 | R, E1 | E, readonly [A, A1]>
```

Added in v1.0.0

## zipLeft

**Signature**

```ts
export declare const zipLeft: <R1, E1, A1>(
  that: STM<R1, E1, A1>
) => <R, E, A>(self: STM<R, E, A>) => STM<R1 | R, E1 | E, A>
```

Added in v1.0.0

## zipRight

**Signature**

```ts
export declare const zipRight: <R1, E1, A1>(
  that: STM<R1, E1, A1>
) => <R, E, A>(self: STM<R, E, A>) => STM<R1 | R, E1 | E, A1>
```

Added in v1.0.0

## zipWith

**Signature**

```ts
export declare const zipWith: <R1, E1, A1, A, A2>(
  that: STM<R1, E1, A1>,
  f: (a: A, b: A1) => A2
) => <R, E>(self: STM<R, E, A>) => STM<R1 | R, E1 | E, A2>
```

Added in v1.0.0
