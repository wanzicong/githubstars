import { useState, useEffect, useCallback } from 'react'
import { Card, Form, Input, Button, Typography, message, Spin, Space, Tag, Divider } from 'antd'
import { SaveOutlined, ReloadOutlined, KeyOutlined, SettingOutlined } from '@ant-design/icons'
import * as configApi from '../api/config'
import type { ConfigItem } from '../api/config'

const { Title, Text, Paragraph } = Typography

export default function Settings() {
  const [configs, setConfigs] = useState<ConfigItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const loadConfig = useCallback(async () => {
    setLoading(true)
    try {
      const data = await configApi.fetchAllConfig()
      setConfigs(data)
      const initial: Record<string, string> = {}
      data.forEach((item) => { initial[item.configKey] = item.configValue || '' })
      form.setFieldsValue(initial)
    } catch { message.error('加载配置失败') }
    finally { setLoading(false) }
  }, [form])

  useEffect(() => { loadConfig() }, [loadConfig])

  const handleSave = async (values: Record<string, string>) => {
    setSaving(true)
    try {
      const result = await configApi.saveConfig(values)
      if (result.success) {
        message.success('配置已保存并生效')
        loadConfig()
      } else {
        message.error(result.message || '保存失败')
      }
    } catch { message.error('保存配置失败') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>
        <SettingOutlined style={{ marginRight: 8 }} />
        系统配置
      </Title>

      <Spin spinning={loading}>
        <Card style={{ maxWidth: 700 }}>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSave}
          >
            {configs.map((cfg) => (
              <Form.Item
                key={cfg.configKey}
                name={cfg.configKey}
                label={
                  <Space>
                    <KeyOutlined />
                    <Text strong>{cfg.configKey}</Text>
                    {cfg.sensitive && <Tag color="orange" style={{ fontSize: 10 }}>敏感</Tag>}
                  </Space>
                }
                extra={<Text type="secondary" style={{ fontSize: 12 }}>{cfg.description}</Text>}
              >
                <Input.Password
                  placeholder={cfg.sensitive ? '输入后保存，留空则不修改' : cfg.description}
                  iconRender={(visible) => (visible ? <span>👁</span> : <span>🔒</span>)}
                />
              </Form.Item>
            ))}

            <Divider />

            <div style={{ display: 'flex', gap: 12 }}>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={saving}
                size="large"
              >
                保存配置
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={loadConfig}
                size="large"
              >
                刷新
              </Button>
            </div>

            <Paragraph type="secondary" style={{ marginTop: 16, fontSize: 12 }}>
              💡 提示：敏感字段（Token/API Key）已脱敏显示。留空保存不会清除已有值。
              修改后立即生效，无需重启服务。
            </Paragraph>
          </Form>
        </Card>
      </Spin>
    </div>
  )
}
