import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Row, Col, Tag, Typography, Avatar, Tooltip } from 'antd'
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

interface RepoRowProps {
    repo: GithubRepo
    /** 点击标签下钻：传入 tagId 触发筛选 */
    onTagClick?: (tagId: number) => void
    /** 当前已选中的 tagId 集合（高亮已选标签） */
    selectedTagIds?: Set<number>
}

/** 列表行视图 — 每个仓库展示为横向行卡片（React.memo 避免列表项无效重渲染） */
const RepoRow = memo(function RepoRow({ repo, onTagClick, selectedTagIds }: RepoRowProps) {
    const navigate = useNavigate()

    return (
        <Card
            hoverable
            style={{ cursor: 'pointer' }}
            styles={{ body: { padding: 12 } }}
            onClick={() => navigate(`/stars/${repo.id}`)}
        >
            <Row align='middle' gutter={[12, 8]}>
                <Col xs={24} sm={12} md={14}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Avatar src={repo.ownerAvatarUrl} alt={repo.ownerName} size={44} style={{ flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                            <Text strong style={{ fontSize: 16 }} ellipsis>
                                <span style={{ color: '#1677ff' }}>{repo.repoName}</span>
                            </Text>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                                <Text type='secondary' style={{ fontSize: 13 }}>
                                    {repo.ownerName}
                                </Text>
                                {repo.language && (
                                    <Tag color='blue' style={{ margin: 0, fontSize: 12 }}>
                                        {repo.language}
                                    </Tag>
                                )}
                                {repo.tags && repo.tags.length > 0
                                    ? (() => {
                                          // 按维度分组 + 建树（父标签 → 子标签）
                                          const groupMap = new Map<number, { gn: string; gc: string; gi: string | null; parents: Array<{ p: typeof repo.tags[0]; children: typeof repo.tags[0][] }> }>()
                                          for (const t of repo.tags) {
                                              if (!groupMap.has(t.groupId)) {
                                                  groupMap.set(t.groupId, { gn: t.groupName, gc: t.groupColor, gi: t.groupIcon, parents: [] })
                                              }
                                          }
                                          for (const g of groupMap.values()) {
                                              const dimTags = repo.tags!.filter(t => t.groupId === repo.tags!.find(rt => rt.groupName === g.gn)!.groupId)
                                              const parents = dimTags.filter(t => !t.parentId || !dimTags.some(rt => rt.id === t.parentId))
                                              const childMap = new Map<number, typeof repo.tags[0][]>()
                                              for (const t of dimTags.filter(t => t.parentId && dimTags.some(rt => rt.id === t.parentId))) {
                                                  if (!childMap.has(t.parentId!)) childMap.set(t.parentId!, [])
                                                  childMap.get(t.parentId!)!.push(t)
                                              }
                                              g.parents = parents.map(p => ({ p, children: childMap.get(p.id) || [] }))
                                          }
                                          return Array.from(groupMap.values()).slice(0, 2).map((g) => (
                                              <span key={g.gn} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11 }}>
                                                  <span style={{ fontSize: 10, opacity: 0.55, marginRight: 1 }} title={g.gn}>{g.gi || '📌'}</span>
                                                  {g.parents.flatMap(({ p, children }) => {
                                                      const pSel = selectedTagIds?.has(p.id)
                                                      const tags = [
                                                          <Tooltip key={p.id} title={`${g.gn} — 点击下钻`} mouseEnterDelay={0.5}>
                                                              <Tag color={pSel ? 'blue' : 'cyan'} style={{ margin: 0, fontSize: 11, borderRadius: 10, cursor: 'pointer', padding: '0 6px', fontWeight: pSel ? 600 : 500, lineHeight: '18px' }}
                                                                  onClick={(e) => { e.stopPropagation(); onTagClick?.(p.id) }}>{p.name}</Tag>
                                                          </Tooltip>,
                                                          ...children.slice(0, 3).map((c) => {
                                                              const cSel = selectedTagIds?.has(c.id)
                                                              return (
                                                                  <Tooltip key={c.id} title={`${g.gn} · ${p.name} 的子标签`} mouseEnterDelay={0.5}>
                                                                      <Tag color={cSel ? 'blue' : 'default'} style={{ margin: 0, fontSize: 10, borderRadius: 8, cursor: 'pointer', padding: '0 5px', fontWeight: cSel ? 600 : 400, opacity: 0.8, lineHeight: '16px' }}
                                                                          onClick={(e) => { e.stopPropagation(); onTagClick?.(c.id) }}>{c.name}</Tag>
                                                                  </Tooltip>
                                                              )
                                                          }),
                                                      ]
                                                      return tags
                                                  })}
                                              </span>
                                          ))
                                      })()
                                    : repo.tagNames &&
                                      repo.tagNames.length > 0 &&
                                      repo.tagNames.slice(0, 2).map((t) => (
                                          <Tag key={t} color='cyan' style={{ margin: 0, fontSize: 12, borderRadius: 10 }}>
                                              {t}
                                          </Tag>
                                      ))}
                                {repo.readmeFetched && repo.readmeCn ? (
                                    <Tag color='purple' style={{ margin: 0, fontSize: 11 }}>
                                        <ReadOutlined style={{ fontSize: 10 }} /> 已翻译
                                    </Tag>
                                ) : repo.readmeFetched ? (
                                    <Tag color='default' style={{ margin: 0, fontSize: 11 }}>
                                        无README
                                    </Tag>
                                ) : null}
                            </div>
                            {repo.descriptionCn ? (
                                <Paragraph
                                    ellipsis={{ rows: 1 }}
                                    style={{ margin: '4px 0 0', fontSize: 14, color: '#333', lineHeight: '1.6' }}
                                >
                                    {repo.descriptionCn}
                                </Paragraph>
                            ) : repo.description ? (
                                <Paragraph
                                    type='secondary'
                                    ellipsis={{ rows: 1 }}
                                    style={{ margin: '4px 0 0', fontSize: 14, lineHeight: '1.6' }}
                                >
                                    {repo.description}
                                </Paragraph>
                            ) : null}
                        </div>
                    </div>
                </Col>
                <Col xs={24} sm={12} md={10}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
                        <span>
                            <StarFilled style={{ color: '#faad14', fontSize: 14 }} />{' '}
                            <Text style={{ fontSize: 15 }}>{repo.starsCount}</Text>
                            <Text type='secondary' style={{ fontSize: 12, marginLeft: 2 }}>
                                {formatNumberCn(repo.starsCount)}
                            </Text>
                        </span>
                        <span>
                            <ForkOutlined style={{ fontSize: 14 }} /> <Text style={{ fontSize: 15 }}>{repo.forksCount}</Text>
                            <Text type='secondary' style={{ fontSize: 12, marginLeft: 2 }}>
                                {formatNumberCn(repo.forksCount)}
                            </Text>
                        </span>
                        {repo.repoPushedAt &&
                            (() => {
                                const days = Math.floor(
                                    (Date.now() - new Date(repo.repoPushedAt).getTime()) / (1000 * 60 * 60 * 24),
                                )
                                let color: string = 'green'
                                if (days > 180) color = 'red'
                                else if (days > 30) color = 'orange'
                                return (
                                    <Tag color={color} style={{ margin: 0, fontSize: 12 }}>
                                        未更新 {days} 天
                                    </Tag>
                                )
                            })()}
                        <Text type='secondary' style={{ fontSize: 13 }}>
                            Star 于 {formatDate(repo.starredAt)}
                        </Text>
                    </div>
                </Col>
            </Row>
        </Card>
    )
})

export default RepoRow
