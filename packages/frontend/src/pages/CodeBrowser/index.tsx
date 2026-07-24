import { useEffect, useState } from 'react'
import { App, Button, Card, Empty, Select, Space, Spin, Tooltip, Typography, theme } from 'antd'
import { CodeOutlined, GithubOutlined, LinkOutlined, ReloadOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import { fetchStarList } from '../../api'
import type { GithubRepo } from '../../types'

const { Title, Text } = Typography

/** github1s 嵌入地址 —— VS Code 风格在线浏览仓库（已验证无 X-Frame-Options 限制） */
const buildGithub1sUrl = (fullName: string): string => `https://github1s.com/${fullName}`
const buildGithubUrl = (fullName: string): string => `https://github.com/${fullName}`

interface RepoOption {
  value: string
  label: string
  desc: string
}

/** 映射仓库记录为选择器选项 */
const toRepoOption = (r: GithubRepo): RepoOption => ({
  value: r.fullName,
  label: r.fullName,
  desc: r.description ?? '',
})

/**
 * 代码浏览页 —— 选择 Star 仓库，iframe 嵌入 github1s 在线浏览代码。
 * 选择状态同步到 ?repo= 查询参数，刷新页面后保持。
 */
export default function CodeBrowser() {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const [searchParams, setSearchParams] = useSearchParams()
  const repoParam = searchParams.get('repo') ?? ''

  const [options, setOptions] = useState<RepoOption[]>([])
  const [reposLoading, setReposLoading] = useState(true)
  // 带 ?repo= 进入时 iframe 立即开始加载，初始即展示加载态
  const [frameLoading, setFrameLoading] = useState(repoParam !== '')
  const [frameFailed, setFrameFailed] = useState(false)
  const [frameKey, setFrameKey] = useState(0)

  // iframe 加载超时兜底：浏览器加载失败（如代理错误页）时 onLoad 不可靠，
  // 超过 20s 未完成加载则标记失败，给用户明确提示和重试入口
  useEffect(() => {
    if (!repoParam || !frameLoading) return
    const timer = setTimeout(() => {
      setFrameLoading(false)
      setFrameFailed(true)
    }, 20000)
    return () => clearTimeout(timer)
  }, [repoParam, frameLoading, frameKey])

  // 首次加载拉取 Star 仓库列表（分页拉取，选择器本地过滤，异步回调中 setState）
  // 后端 size 上限 100，分批拉全量
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const pageSize = 100
        const first = await fetchStarList({ page: 1, size: pageSize })
        const totalPages = Math.max(first.pages, 1)
        const allRecords = [...first.records]
        for (let p = 2; p <= totalPages; p++) {
          const data = await fetchStarList({ page: p, size: pageSize })
          allRecords.push(...data.records)
        }
        if (cancelled) return
        setOptions(allRecords.map(toRepoOption))
      } catch (e: unknown) {
        if (!cancelled) message.error(e instanceof Error ? e.message : '获取 Star 列表失败')
      } finally {
        if (!cancelled) setReposLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [message])

  const handleSelect = (fullName: string) => {
    setFrameLoading(true)
    setFrameFailed(false)
    setSearchParams({ repo: fullName })
  }

  const handleRefresh = () => {
    setFrameLoading(true)
    setFrameFailed(false)
    setFrameKey((k) => k + 1)
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        // header(56) + tabs(40) + footer(40) + content padding(16*2)，与 AgentChat 页保持一致
        height: 'calc(100vh - 56px - 40px - 40px - 32px)',
      }}
    >
      {/* ── 工具栏 ── */}
      <Card size="small" styles={{ body: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' } }}>
        <CodeOutlined style={{ fontSize: 18, color: token.colorPrimary }} />
        <Title level={5} style={{ margin: 0 }}>代码浏览</Title>
        <Select
          showSearch
          value={repoParam || undefined}
          options={options}
          loading={reposLoading}
          placeholder="选择 Star 仓库（可搜索）…"
          onChange={handleSelect}
          filterOption={(input, option) =>
            String(option?.value ?? '').toLowerCase().includes(input.toLowerCase())
          }
          optionRender={(option) => (
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <Text strong style={{ fontSize: 13 }}>{String(option.data.value)}</Text>
              {(option.data as RepoOption).desc && (
                <Text type="secondary" style={{ fontSize: 12, maxWidth: '100%' }} ellipsis>
                  {(option.data as RepoOption).desc}
                </Text>
              )}
            </div>
          )}
          style={{ flex: 1, maxWidth: 520, minWidth: 240 }}
        />
        <div style={{ flex: 1 }} />
        <Space size={8}>
          <Tooltip title="刷新嵌入页">
            <Button icon={<ReloadOutlined />} disabled={!repoParam} onClick={handleRefresh} />
          </Tooltip>
          <Tooltip title="在 github1s 新标签打开">
            <Button
              icon={<LinkOutlined />}
              disabled={!repoParam}
              href={repoParam ? buildGithub1sUrl(repoParam) : undefined}
              target="_blank"
            />
          </Tooltip>
          <Tooltip title="在 GitHub 打开仓库">
            <Button
              type="primary"
              ghost
              icon={<GithubOutlined />}
              disabled={!repoParam}
              href={repoParam ? buildGithubUrl(repoParam) : undefined}
              target="_blank"
            />
          </Tooltip>
        </Space>
      </Card>

      {/* ── 嵌入区 ── */}
      <div
        style={{
          flex: 1,
          minHeight: 0, // flex 子项允许收缩，否则 iframe 撑破容器
          position: 'relative',
          borderRadius: 8,
          overflow: 'hidden',
          border: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgContainer,
        }}
      >
        {repoParam ? (
          <>
            {frameLoading && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  zIndex: 1,
                  background: token.colorBgContainer,
                }}
              >
                <Spin size="large" />
                <Text type="secondary">正在加载 github1s 代码浏览…</Text>
              </div>
            )}
            {frameFailed && !frameLoading && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 16,
                  zIndex: 2,
                  background: token.colorBgContainer,
                }}
              >
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <Text type="secondary">github1s 加载超时，可能是网络受限</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>可尝试在 github1s 新标签打开，或检查网络后重试</Text>
                    </div>
                  }
                />
                <Space>
                  <Button icon={<ReloadOutlined />} onClick={handleRefresh}>重试</Button>
                  <Button type="primary" ghost href={buildGithub1sUrl(repoParam)} target="_blank">新标签打开</Button>
                </Space>
              </div>
            )}
            <iframe
              key={`${repoParam}-${frameKey}`}
              src={buildGithub1sUrl(repoParam)}
              onLoad={() => {
                setFrameLoading(false)
                setFrameFailed(false)
              }}
              title={`代码浏览 - ${repoParam}`}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            />
          </>
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="从上方选择一个 Star 仓库，即可在 VS Code 界面中浏览代码"
            />
          </div>
        )}
      </div>
    </div>
  )
}
