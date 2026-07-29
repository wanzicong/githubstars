// API client
export { default as apiClient, setBaseURL, getCurrentBaseURL } from './request'

// Stars
export { fetchStarList, fetchRepoDetail, exportStarsUrls, fetchAllStarIds } from './stars'
export { fetchRepoIssueDetail, fetchRepoIssues } from './issues'
export { findSimilarRepos as fetchSimilarRepos } from './similar'

// Authors
export { fetchAuthorList, fetchAuthorRepos, exportAuthorUrls } from './authors'

// Trending
export { fetchTrending, downloadTrending } from './trending'

// GitHub Search
export { searchRepos, starRepo, checkStarred } from './github'

// System
export { fetchAllConfig, saveConfig } from './config'
export { fetchLogFiles, fetchLogContent, clearLogFile } from './logs'
export { fetchLogFiles as fetchLogs, clearLogFile as clearLogs } from './logs'
export {
    fetchOverviewStats,
    fetchLanguageStats,
    fetchOwnerStats,
    fetchTimelineStats,
    fetchTopStarredRepos,
    fetchRecentActiveRepos,
} from './stats'
export { triggerManualSync, fetchSyncStatus, fetchSyncLogs } from './sync'
export { triggerManualSync as startSync, fetchSyncStatus as getSyncStatus } from './sync'

// Clone
export { createCloneTask, getCloneTaskProgress, retryCloneFailed, getRecentCloneTasks } from './clone'
export type { CloneTaskProgress, CloneTaskListResult } from './clone'

// Category
export {
    fetchCategoryTree,
    fetchCategoryList,
    createCategory,
    updateCategory,
    deleteCategory,
    sortCategories,
    fetchCategoryRepos,
    bindCategoryRepos,
    unbindCategoryRepos,
    fetchRepoCategories,
} from './category'
export type { CategoryListParams, CategoryListResult, CategorySaveParams, CategoryReposParams } from './category'

// Learn
export {
    fetchLearnList,
    fetchLearnDetail,
    createLearnRecord,
    quickAddLearn,
    checkLearnRepos,
    updateLearnRecord,
    deleteLearnRecord,
    fetchLearnStats,
    fetchLearnTags,
    createLearnTag,
    updateLearnTag,
    deleteLearnTag,
} from './learn'
export type { LearnCreatePayload, LearnUpdatePayload } from './learn'
