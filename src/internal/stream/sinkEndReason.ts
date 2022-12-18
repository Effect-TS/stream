/** @internal */
export type SinkEndReason = ScheduleEnd | UpstreamEnd

/** @internal */
export const OP_SCHEDULE_END = 0 as const

/** @internal */
export type OP_SCHEDULE_END = typeof OP_SCHEDULE_END

/** @internal */
export const OP_UPSTREAM_END = 1 as const

/** @internal */
export type OP_UPSTREAM_END = typeof OP_UPSTREAM_END

/** @internal */
export interface ScheduleEnd {
  readonly op: OP_SCHEDULE_END
}

/** @internal */
export interface UpstreamEnd {
  readonly op: OP_UPSTREAM_END
}

/** @internal */
export const SchedulEnd: SinkEndReason = { op: OP_SCHEDULE_END }

/** @internal */
export const UpstreamEnd: SinkEndReason = { op: OP_UPSTREAM_END }
