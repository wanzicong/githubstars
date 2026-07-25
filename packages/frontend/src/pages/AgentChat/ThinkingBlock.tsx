import { useEffect, useRef, useState } from 'react'
import { Typography, theme } from 'antd'
import { BulbOutlined, DownOutlined, RightOutlined } from '@ant-design/icons'

const { Text } = Typography

interface ThinkingBlockProps {
  content: string
  /** 流式输出中：强制展开并显示进行态 */
  streaming?: boolean
}

/**
 * 思考过程展示块 —— 对齐 Claude Code 的 thinking 展示体验。
 * 流式时展开实时滚动；完成后默认折叠，点击标题展开。
 * 展开时测量整体高度，折叠后以 minHeight 占位，避免条件渲染导致列表高度突变抖动。
 */
export default function ThinkingBlock({ content, streaming = false }: ThinkingBlockProps) {
  const { token } = theme.useToken()
  const [expanded, setExpanded] = useState(false)
  const [expandedHeight, setExpandedHeight] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const showContent = streaming || expanded

  // 非流式展开时测量整体高度（含标题行），折叠后用作 minHeight 占位防止抖动
  useEffect(() => {
    if (showContent && !streaming && rootRef.current) {
      setExpandedHeight(rootRef.current.offsetHeight)
    }
  }, [showContent, streaming, content])

  // 流式输出时内容区自动滚到底部
  useEffect(() => {
    if (streaming && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [content, streaming])

  const collapsedMinHeight = expandedHeight > 0 ? expandedHeight : undefined

  return (
    <div
      ref={rootRef}
      style={{
        marginBottom: 10,
        borderLeft: `3px solid ${token.colorPrimaryBorder}`,
        background: token.colorFillQuaternary,
        borderRadius: 8,
        overflow: 'hidden',
        minHeight: showContent ? undefined : collapsedMinHeight,
      }}
    >
      <div
        onClick={streaming ? undefined : () => setExpanded((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          cursor: streaming ? 'default' : 'pointer',
          userSelect: 'none',
        }}
      >
        <BulbOutlined style={{ color: token.colorPrimary, fontSize: 13 }} />
        <Text type="secondary" style={{ fontSize: 12, flex: 1 }}>
          {streaming ? '正在思考…' : '思考过程'}
        </Text>
        {!streaming &&
          (expanded ? (
            <DownOutlined style={{ fontSize: 10, color: token.colorTextTertiary }} />
          ) : (
            <RightOutlined style={{ fontSize: 10, color: token.colorTextTertiary }} />
          ))}
      </div>
      {showContent && (
        <div
          ref={bodyRef}
          style={{
            padding: '0 10px 8px',
            fontSize: 12,
            lineHeight: 1.6,
            color: token.colorTextSecondary,
            fontStyle: 'italic',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: streaming ? 200 : 400,
            overflowY: 'auto',
          }}
        >
          {content}
        </div>
      )}
    </div>
  )
}
