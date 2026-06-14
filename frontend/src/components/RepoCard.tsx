import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Tag, Typography, Avatar, Space, Tooltip } from 'antd'
import { StarFilled, ForkOutlined, ReadOutlined } from '@ant-design/icons'
import { formatNumberCn } from '@/utils/format'
import type { GithubRepo } from '@/types'

const { Text, Paragraph } = Typography

function formatDate(dateStr: string | number[] | null): string {
    if (!dateStr) return '-'
    if (Array.isArray(dateStr)) {
        const [y, m, d] = dateStr
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }
    if (typeof dateStr === 'string') {
        return dateStr.length >= 10 ? dateStr.substring(0, 10) : dateStr
    }
    return String(dateStr)
}

interface RepoCardProps {
    repo: GithubRepo
    /** 点击标签下钻：传入 tagId 触发筛选 */
    onTagClick?: (tagId: number) => void
    /** 当前已选中的 tagId 集合（高亮已选标签） */
    selectedTagIds?: Set<number>
}

/** 网格卡片视图 — 每个仓库展示为可点击卡片（React.memo 避免列表项无效重渲染） */
const RepoCard = memo(function RepoCard({ repo, onTagClick, selectedTagIds }: RepoCardProps) {
    const navigate = useNavigate()

    return (
        <Card
            hoverable
            style={{ height: '100%', cursor: 'pointer' }}
            styles={{ body: { padding: 16 } }}
            onClick={() => navigate(`/stars/${repo.id}`)}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                <Avatar src={repo.ownerAvatarUrl} alt={repo.ownerName} size={48} style={{ flexShrink: 0 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                    <Text strong style={{ fontSize: 16, display: 'block', lineHeight: '24px' }} ellipsis>
                        <span style={{ color: '#1677ff' }}>{repo.repoName}</span>
                    </Text>
                    <Text type='secondary' style={{ fontSize: 14 }} ellipsis>
                        {repo.ownerName}
                    </Text>
                </div>
            </div>
            {repo.descriptionCn ? (
                <Paragraph
                    ellipsis={{ rows: 2 }}
                    style={{ marginBottom: 10, fontSize: 14, minHeight: 40, color: '#333', lineHeight: '1.6' }}
                >
                    {repo.descriptionCn}
                    <Text type='secondary' style={{ fontSize: 12, marginLeft: 4 }}>
                        🇨🇳
                    </Text>
                </Paragraph>
            ) : repo.description ? (
                <Paragraph
                    type='secondary'
                    ellipsis={{ rows: 2 }}
                    style={{ marginBottom: 10, fontSize: 14, minHeight: 40, lineHeight: '1.6' }}
                >
                    {repo.description}
                </Paragraph>
            ) : null}
            {/* 标签行 — 技术栈 + 层级化可下钻标签 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {repo.language && (
                    <Tag color='processing' style={{ margin: 0, fontSize: 12, borderRadius: 10 }}>
                        {repo.language}
                    </Tag>
                )}
                {repo.tags && repo.tags.length > 0
                    ? (() => {
                          // 按维度分组，每组内按层级排序（父标签在前，子标签在后）
                          const groupMap = new Map<number, { groupName: string; groupColor: string; groupIcon: string | null; tags: typeof repo.tags }>()
                          for (const t of repo.tags) {
                              if (!groupMap.has(t.groupId)) {
                                  groupMap.set(t.groupId, { groupName: t.groupName, groupColor: t.groupColor, groupIcon: t.groupIcon, tags: [] })
                              }
                              groupMap.get(t.groupId)!.tags.push(t)
                          }
                          const groups = Array.from(groupMap.values())
                          // 每组内：无 parentId 的排前面（一级标签），有 parentId 的排后面（子标签）
                          for (const g of groups) {
                              g.tags.sort((a, b) => (a.parentId ? 1 : 0) - (b.parentId ? 1 : 0))
                          }
                          return groups.map((g) => (
                              <div
                                  key={g.groupName}
                                  style={{
                                      display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 3,
                                      padding: '2px 6px', borderRadius: 6,
                                      border: `1px solid ${g.groupColor}20`,
                                      background: `${g.groupColor}08`,
                                  }}
                              >
                                  {/* 维度图标 */}
                                  <span style={{ fontSize: 11, opacity: 0.7, marginRight: 1 }} title={g.groupName}>
                                      {g.groupIcon || '📌'}
                                  </span>
                                  {g.tags.map((t) => {
                                      const isSelected = selectedTagIds?.has(t.id)
                                      const isChild = t.parentId != null
                                      return (
                                          <Tooltip key={t.id} title={`${g.groupName}${isChild ? ' · 子标签' : ''} — 点击下钻`} mouseEnterDelay={0.5}>
                                              <Tag
                                                  color={isSelected ? 'blue' : 'cyan'}
                                                  style={{
                                                      margin: 0,
                                                      fontSize: 11,
                                                      borderRadius: 10,
                                                      cursor: 'pointer',
                                                      padding: isChild ? '0 6px' : '0 8px',
                                                      opacity: isSelected ? 1 : isChild ? 0.75 : 0.9,
                                                      fontWeight: isSelected ? 600 : isChild ? 400 : 500,
                                                  }}
                                                  onClick={(e) => {
                                                      e.stopPropagation()
                                                      onTagClick?.(t.id)
                                                  }}
                                              >
                                                  {isChild ? '↳ ' : ''}{t.name}
                                              </Tag>
                                          </Tooltip>
                                      )
                                  })}
                              </div>
                          ))
                      })()
                    : repo.tagNames &&
                      repo.tagNames.length > 0 &&
                      repo.tagNames.map((t) => (
                          <Tag key={t} color='cyan' style={{ margin: 0, fontSize: 12, borderRadius: 10 }}>
                              {t}
                          </Tag>
                      ))}
                {repo.readmeFetched && repo.readmeCn ? (
                    <Tag color='purple' style={{ margin: 0, fontSize: 12 }}>
                        <ReadOutlined style={{ fontSize: 11 }} /> 已翻译
                    </Tag>
                ) : repo.readmeFetched ? (
                    <Tag color='default' style={{ margin: 0, fontSize: 12 }}>
                        无README
                    </Tag>
                ) : null}
                <Space size={4}>
                    <StarFilled style={{ color: '#faad14', fontSize: 14 }} />
                    <Text style={{ fontSize: 14 }}>{repo.starsCount}</Text>
                    <Text type='secondary' style={{ fontSize: 12 }}>
                        {formatNumberCn(repo.starsCount)}
                    </Text>
                </Space>
                <Space size={4}>
                    <ForkOutlined style={{ fontSize: 14 }} />
                    <Text style={{ fontSize: 14 }}>{repo.forksCount}</Text>
                    <Text type='secondary' style={{ fontSize: 12 }}>
                        {formatNumberCn(repo.forksCount)}
                    </Text>
                </Space>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                <Text type='secondary' style={{ fontSize: 13 }}>
                    Star 于 {formatDate(repo.starredAt)}
                </Text>
                {repo.repoPushedAt &&
                    (() => {
                        const days = Math.floor((Date.now() - new Date(repo.repoPushedAt).getTime()) / (1000 * 60 * 60 * 24))
                        let color: string = 'green'
                        if (days > 180) color = 'red'
                        else if (days > 30) color = 'orange'
                        return (
                            <Tag color={color} style={{ margin: 0, fontSize: 12 }}>
                                未更新 {days} 天
                            </Tag>
                        )
                    })()}
            </div>
        </Card>
    )
})

export default RepoCard
