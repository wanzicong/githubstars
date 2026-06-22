// API client
export { default as apiClient, setBaseURL, getBaseURL } from './request'

// Stars
export { fetchStarList, exportStarsUrls } from './stars'
export { findSimilarRepos as fetchSimilarRepos } from './similar'

// Authors
export { fetchAuthorList, fetchAuthorRepos, exportAuthorUrls } from './authors'

// Trending
export { fetchTrending, translateTrending } from './trending'

// GitHub Search
export { searchRepos, starRepo, checkStarred } from './github'

// System
export { fetchAllConfig, saveConfig } from './config'
export { fetchLogFiles, fetchLogContent, clearLogFile } from './logs'
export { fetchLogFiles as fetchLogs, clearLogFile as clearLogs } from './logs'
export { fetchOverviewStats, fetchLanguageStats, fetchOwnerStats, fetchTimelineStats, fetchTopStarredRepos, fetchRecentActiveRepos } from './stats'
export { triggerManualSync, fetchSyncStatus, fetchSyncLogs } from './sync'
export { triggerManualSync as startSync, fetchSyncStatus as getSyncStatus } from './sync'

// Translate
export {
  fetchRepoDetail,
  getTranslateConfig,
  translateDescription,
  startSingleReadme,
  retranslateReadme,
  translateBatch as startBatchTranslate,
  startFilterBatch as startFilterBatchTranslate,
  getTaskProgress,
  retryFailed,
  getRecentTasks,
  getTranslationStatus as getTranslationStats,
} from './translate'

// Clone
export { createCloneTask, getCloneTaskProgress, retryCloneFailed, getRecentCloneTasks } from './clone'
export type { CloneTaskProgress, CloneTaskListResult } from './clone'
