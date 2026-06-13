import { Component, type ReactNode, type ErrorInfo } from 'react'
import { Button, Result } from 'antd'
import { ReloadOutlined, HomeOutlined } from '@ant-design/icons'

interface Props {
    children: ReactNode
    /** 自定义 fallback UI，不传则使用默认 Result */
    fallback?: ReactNode
}

interface State {
    hasError: boolean
    error: Error | null
    errorInfo: ErrorInfo | null
}

/**
 * 全局错误边界 — 捕获组件树中未处理的异常，阻止白屏。
 * 使用 Ant Design Result 组件提供友好的错误展示和恢复入口。
 */
export default class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, error: null, errorInfo: null }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[ErrorBoundary] 捕获到未处理异常:', error, errorInfo)
        this.setState({ errorInfo })
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null })
    }

    handleReload = () => {
        window.location.reload()
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback

            return (
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        minHeight: '60vh',
                        padding: 24,
                    }}
                >
                    <Result
                        status='error'
                        title='页面出错了'
                        subTitle={
                            <span style={{ maxWidth: 500, display: 'inline-block' }}>
                                {this.state.error?.message || '发生了未知错误，请尝试刷新页面。'}
                            </span>
                        }
                        extra={[
                            <Button key='retry' type='primary' icon={<ReloadOutlined />} onClick={this.handleReload}>
                                刷新页面
                            </Button>,
                            <Button key='home' icon={<HomeOutlined />} onClick={this.handleReset}>
                                返回首页
                            </Button>,
                        ]}
                    />
                </div>
            )
        }

        return this.props.children
    }
}
