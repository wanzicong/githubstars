import type {
    GithubIssue,
    GithubIssueComment,
    GithubIssueDetail,
    GithubIssueLabel,
    GithubIssueReactions,
    GithubIssueUser,
} from '@githubstars/shared';

const SCOPED_QUALIFIER_PATTERN = /\b(?:repo|org|user|state|is|type):(?:"[^"]*"|\S+)/giu;
const BOOLEAN_OR_PATTERN = /\bOR\b/giu;

/**
 * 清理用户输入中会改变仓库或 Issue 类型范围的 GitHub 搜索限定词。
 *
 * 标签、作者等 Issue 内部限定词仍可使用；repo/org/user/state/is/type
 * 由后端统一追加，避免查询越出当前详情页仓库。
 */
export function sanitizeIssueSearchText(value: string | undefined): string {
    return (value || '').slice(0, 200).replace(SCOPED_QUALIFIER_PATTERN, ' ').replace(BOOLEAN_OR_PATTERN, ' ').replace(/\s+/gu, ' ').trim();
}

function mapIssueUser(value: unknown): GithubIssueUser | null {
    if (!value || typeof value !== 'object') return null;
    const user = value as Record<string, unknown>;
    if (typeof user.login !== 'string' || !user.login) return null;
    return {
        login: user.login,
        avatarUrl: typeof user.avatar_url === 'string' ? user.avatar_url : '',
        htmlUrl: typeof user.html_url === 'string' ? user.html_url : '',
    };
}

function mapIssueLabel(value: unknown): GithubIssueLabel | null {
    if (typeof value === 'string') {
        return { name: value, color: 'd0d7de', description: null };
    }
    if (!value || typeof value !== 'object') return null;
    const label = value as Record<string, unknown>;
    if (typeof label.name !== 'string' || !label.name) return null;
    return {
        name: label.name,
        color: typeof label.color === 'string' && label.color ? label.color : 'd0d7de',
        description: typeof label.description === 'string' ? label.description : null,
    };
}

function mapIssueReactions(value: unknown): GithubIssueReactions {
    const reactions = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
    const numberValue = (key: string) => (typeof reactions[key] === 'number' ? reactions[key] : 0);
    return {
        totalCount: numberValue('total_count'),
        plusOne: numberValue('+1'),
        minusOne: numberValue('-1'),
        laugh: numberValue('laugh'),
        hooray: numberValue('hooray'),
        confused: numberValue('confused'),
        heart: numberValue('heart'),
        rocket: numberValue('rocket'),
        eyes: numberValue('eyes'),
    };
}

/**
 * 将 GitHub Search Issues API 原始条目映射为前后端共享的精简结构。
 */
export function mapGithubIssue(value: unknown): GithubIssue | null {
    if (!value || typeof value !== 'object') return null;
    const issue = value as Record<string, unknown>;
    if (
        typeof issue.id !== 'number' ||
        typeof issue.number !== 'number' ||
        typeof issue.title !== 'string' ||
        typeof issue.html_url !== 'string'
    ) {
        return null;
    }

    const labels = Array.isArray(issue.labels)
        ? issue.labels.map(mapIssueLabel).filter((label): label is GithubIssueLabel => label !== null)
        : [];
    const assignees = Array.isArray(issue.assignees)
        ? issue.assignees.map(mapIssueUser).filter((user): user is GithubIssueUser => user !== null)
        : [];
    const milestone = issue.milestone && typeof issue.milestone === 'object' ? (issue.milestone as Record<string, unknown>) : null;

    return {
        id: issue.id,
        number: issue.number,
        state: issue.state === 'closed' ? 'closed' : 'open',
        stateReason: typeof issue.state_reason === 'string' ? issue.state_reason : null,
        title: issue.title,
        htmlUrl: issue.html_url,
        user: mapIssueUser(issue.user),
        labels,
        assignees,
        comments: typeof issue.comments === 'number' ? issue.comments : 0,
        locked: issue.locked === true,
        milestoneTitle: milestone && typeof milestone.title === 'string' ? milestone.title : null,
        createdAt: typeof issue.created_at === 'string' ? issue.created_at : '',
        updatedAt: typeof issue.updated_at === 'string' ? issue.updated_at : '',
        closedAt: typeof issue.closed_at === 'string' ? issue.closed_at : null,
    };
}

/** 将仓库 Issue API 返回值映射为包含正文的详情结构。 */
export function mapGithubIssueDetail(value: unknown, commentItems: GithubIssueComment[] = []): GithubIssueDetail | null {
    const issue = mapGithubIssue(value);
    if (!issue || !value || typeof value !== 'object') return null;
    const raw = value as Record<string, unknown>;
    return {
        ...issue,
        body: typeof raw.body === 'string' ? raw.body : '',
        authorAssociation: typeof raw.author_association === 'string' ? raw.author_association : '',
        activeLockReason: typeof raw.active_lock_reason === 'string' ? raw.active_lock_reason : null,
        reactions: mapIssueReactions(raw.reactions),
        commentItems,
        commentsTruncated: issue.comments > commentItems.length,
    };
}

/** 映射 Issue 评论，过滤 GitHub 异常条目。 */
export function mapGithubIssueComment(value: unknown): GithubIssueComment | null {
    if (!value || typeof value !== 'object') return null;
    const comment = value as Record<string, unknown>;
    if (typeof comment.id !== 'number' || typeof comment.html_url !== 'string') return null;
    return {
        id: comment.id,
        body: typeof comment.body === 'string' ? comment.body : '',
        htmlUrl: comment.html_url,
        user: mapIssueUser(comment.user),
        authorAssociation: typeof comment.author_association === 'string' ? comment.author_association : '',
        reactions: mapIssueReactions(comment.reactions),
        createdAt: typeof comment.created_at === 'string' ? comment.created_at : '',
        updatedAt: typeof comment.updated_at === 'string' ? comment.updated_at : '',
    };
}
