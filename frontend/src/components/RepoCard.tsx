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
            {/* 标签行 — 语言 + 树形层级化可下钻标签 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {repo.language && (
                    <Tag color='processing' style={{ margin: 0, fontSize: 12, borderRadius: 10 }}>
                        {repo.language}
                    </Tag>
                )}
                {repo.tags && repo.tags.length > 0
                    ? (() => {
                          // 按维度分组
                          const groupMap = new Map<number, { groupName: string; groupColor: string; groupIcon: string | null; parents: Map<number | null, { tag: typeof repo.tags[0]; children: typeof repo.tags[0][] }> }>()
                          for (const t of repo.tags) {
                              if (!groupMap.has(t.groupId)) {
                                  groupMap.set(t.groupId, { groupName: t.groupName, groupColor: t.groupColor, groupIcon: t.groupIcon, parents: new Map() })
                              }
                              const g = groupMap.get(t.groupId)!
                              // 按 parentId 建树：没有父标签或父标签不在当前仓库的标签中 → 作为根节点
                              const effectiveParent = t.parentId && repo.tags!.some(rt => rt.id === t.parentId) ? t.parentId : null
                              if (!g.parents.has(effectiveParent)) {
                                  // 虚拟根节点
                                  g.parents.set(effectiveParent, { tag: t.parentId ? t : t, children: [] })
                              }
                          }
                          // 重新构建：将每个标签归类到其父节点下
                          for (const g of groupMap.values()) {
                              g.parents.clear()
                              const parentTags = repo.tags!.filter(t => !t.parentId || !repo.tags!.some(rt => rt.id === t.parentId))
                              const childMap = new Map<number, typeof repo.tags[0][]>()
                              for (const t of repo.tags!.filter(t => t.parentId && repo.tags!.some(rt => rt.id === t.parentId))) {
                                  if (!childMap.has(t.parentId!)) childMap.set(t.parentId!, [])
                                  childMap.get(t.parentId!)!.push(t)
                              }
                              for (const p of parentTags) {
                                  g.parents.set(p.id, { tag: p, children: childMap.get(p.id) || [] })
                              }
                          }
                          return Array.from(groupMap.values()).map((g) => (
                              <div
                                  key={g.groupName}
                                  style={{
                                      padding: '3px 7px', borderRadius: 6, fontSize: 11,
                                      border: `1px solid ${g.groupColor}30`,
                                      background: `${g.groupColor}06`,
                                      lineHeight: '22px',
                                  }}
                              >
                                  {/* 维度图标 + 名称 */}
                                  <span style={{ fontSize: 10, opacity: 0.55, marginRight: 4 }} title={g.groupName}>
                                      {g.groupIcon || '📌'}
                                  </span>
                                  {/* 树形标签：每个父标签一行，子标签缩进同行 */}
                                  {Array.from(g.parents.values()).map(({ tag: p, children }) => {
                                      const pSelected = selectedTagIds?.has(p.id)
                                      return (
                                          <span key={p.id} style={{ display: 'inline' }}>
                                              <Tooltip title={`${g.groupName}${p.parentId ? ' · 父标签' : ''} — 点击下钻`} mouseEnterDelay={0.5}>
                                                  <Tag
                                                      color={pSelected ? 'blue' : 'cyan'}
                                                      style={{
                                                          margin: '0 2px 2px 0', fontSize: 11, borderRadius: 10, cursor: 'pointer',
                                                          fontWeight: pSelected ? 600 : 500, lineHeight: '18px',
                                                      }}
                                                      onClick={(e) => { e.stopPropagation(); onTagClick?.(p.id) }}
                                                  >
                                                      {p.name}
                                                  </Tag>
                                              </Tooltip>
                                              {children.length > 0 && (
                                                  <span style={{ paddingLeft: 6, borderLeft: `1px solid ${g.groupColor}30`, marginRight: 2 }}>
                                                      {children.map((c) => {
                                                          const cSelected = selectedTagIds?.has(c.id)
                                                          return (
                                                              <Tooltip key={c.id} title={`${g.groupName} · ${p.name} 的子标签 — 点击下钻`} mouseEnterDelay={0.5}>
                                                                  <Tag
                                                                      color={cSelected ? 'blue' : 'default'}
                                                                      style={{
                                                                          margin: '0 2px 2px 0', fontSize: 10, borderRadius: 8, cursor: 'pointer',
                                                                          fontWeight: cSelected ? 600 : 400, lineHeight: '16px', opacity: 0.8,
                                                                      }}
                                                                      onClick={(e) => { e.stopPropagation(); onTagClick?.(c.id) }}
                                                                  >
                                                                      {c.name}
                                                                  </Tag>
                                                              </Tooltip>
                                                          )
                                                      })}
                                                  </span>
                                              )}
                                          </span>
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
