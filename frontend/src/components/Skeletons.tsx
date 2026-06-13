import { Card, Skeleton } from 'antd'

/** 骨架屏卡片 — 用于列表页加载态 */
export function SkeletonCard({ count = 8 }: { count?: number }) {
    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 16,
            }}
        >
            {Array.from({ length: count }).map((_, i) => (
                <Card key={i} styles={{ body: { padding: 16 } }}>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                        <Skeleton.Avatar active size={48} shape='circle' />
                        <div style={{ flex: 1 }}>
                            <Skeleton.Input active style={{ width: '60%', height: 20, marginBottom: 8 }} />
                            <Skeleton.Input active style={{ width: '40%', height: 16 }} />
                        </div>
                    </div>
                    <Skeleton active paragraph={{ rows: 2 }} title={false} />
                    <Skeleton.Button active style={{ width: 80, height: 22, marginTop: 8 }} />
                </Card>
            ))}
        </div>
    )
}

/** 骨架屏表格 — 用于数据表格加载态 */
export function SkeletonTable({ rows = 5 }: { rows?: number }) {
    return (
        <Card styles={{ body: { padding: 16 } }}>
            <Skeleton active title={{ width: '40%' }} paragraph={{ rows: 1 }} style={{ marginBottom: 16 }} />
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
                    <Skeleton.Input active style={{ width: 60, height: 16 }} />
                    <Skeleton.Input active style={{ flex: 1, height: 16 }} />
                    <Skeleton.Input active style={{ width: 100, height: 16 }} />
                    <Skeleton.Input active style={{ width: 80, height: 16 }} />
                    <Skeleton.Input active style={{ width: 120, height: 16 }} />
                </div>
            ))}
        </Card>
    )
}
