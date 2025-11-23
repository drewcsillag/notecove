/**
 * Note History Module
 *
 * Provides functionality to view and navigate note edit history:
 * - Timeline building (group updates into sessions)
 * - State reconstruction (rebuild document at any point in time)
 */

export {
  TimelineBuilder,
  type ActivitySession,
  type HistoryUpdate,
  type SessionConfig,
  DEFAULT_SESSION_CONFIG,
} from './timeline-builder';

export {
  reconstructAt,
  extractTextContent,
  type ReconstructionPoint,
  type Keyframe,
} from './state-reconstructor';
