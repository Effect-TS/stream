---
title: Channel/UpstreamPullRequest.ts
nav_order: 7
parent: Modules
---

## UpstreamPullRequest overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [constructors](#constructors)
  - [NoUpstream](#noupstream)
  - [Pulled](#pulled)
- [folding](#folding)
  - [match](#match)
- [models](#models)
  - [NoUpstream (interface)](#noupstream-interface)
  - [Pulled (interface)](#pulled-interface)
  - [UpstreamPullRequest (type alias)](#upstreampullrequest-type-alias)
- [refinements](#refinements)
  - [isNoUpstream](#isnoupstream)
  - [isPulled](#ispulled)
  - [isUpstreamPullRequest](#isupstreampullrequest)
- [symbols](#symbols)
  - [UpstreamPullRequestTypeId](#upstreampullrequesttypeid)
  - [UpstreamPullRequestTypeId (type alias)](#upstreampullrequesttypeid-type-alias)

---

# constructors

## NoUpstream

**Signature**

```ts
export declare const NoUpstream: (activeDownstreamCount: number) => UpstreamPullRequest<never>
```

Added in v1.0.0

## Pulled

**Signature**

```ts
export declare const Pulled: <A>(value: A) => UpstreamPullRequest<A>
```

Added in v1.0.0

# folding

## match

Folds an `UpstreamPullRequest<A>` into a value of type `Z`.

**Signature**

```ts
export declare const match: <A, Z>(
  onPulled: (value: A) => Z,
  onNoUpstream: () => Z
) => (self: UpstreamPullRequest<A>) => Z
```

Added in v1.0.0

# models

## NoUpstream (interface)

**Signature**

```ts
export interface NoUpstream extends UpstreamPullRequest.Variance<never> {
  readonly op: OpCodes.OP_NO_UPSTREAM
}
```

Added in v1.0.0

## Pulled (interface)

**Signature**

```ts
export interface Pulled<A> extends UpstreamPullRequest.Variance<A> {
  readonly op: OpCodes.OP_PULLED
  readonly value: A
}
```

Added in v1.0.0

## UpstreamPullRequest (type alias)

**Signature**

```ts
export type UpstreamPullRequest<A> = Pulled<A> | NoUpstream
```

Added in v1.0.0

# refinements

## isNoUpstream

Returns `true` if the specified `UpstreamPullRequest` is a `NoUpstream`,
`false` otherwise.

**Signature**

```ts
export declare const isNoUpstream: <A>(self: UpstreamPullRequest<A>) => self is NoUpstream
```

Added in v1.0.0

## isPulled

Returns `true` if the specified `UpstreamPullRequest` is a `Pulled`, `false`
otherwise.

**Signature**

```ts
export declare const isPulled: <A>(self: UpstreamPullRequest<A>) => self is Pulled<A>
```

Added in v1.0.0

## isUpstreamPullRequest

Returns `true` if the specified value is an `UpstreamPullRequest`, `false`
otherwise.

**Signature**

```ts
export declare const isUpstreamPullRequest: (u: unknown) => u is UpstreamPullRequest<unknown>
```

Added in v1.0.0

# symbols

## UpstreamPullRequestTypeId

**Signature**

```ts
export declare const UpstreamPullRequestTypeId: typeof UpstreamPullRequestTypeId
```

Added in v1.0.0

## UpstreamPullRequestTypeId (type alias)

**Signature**

```ts
export type UpstreamPullRequestTypeId = typeof UpstreamPullRequestTypeId
```

Added in v1.0.0
