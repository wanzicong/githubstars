import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const pluginDir = process.env.GITHUBSTARS_PLUGIN_DIR
const apiUrl = process.env.GITHUBSTARS_SMOKE_API_URL ?? 'http://localhost:10002'

test('已安装的 Claude 插件应能通过 MCP 调用 GitHub Stars 后端', async () => {
    assert.ok(pluginDir, '必须通过 GITHUBSTARS_PLUGIN_DIR 指定已安装的插件目录')

    const client = new Client({ name: 'githubstars-plugin-smoke', version: '1.0.0' }, { capabilities: {} })
    const transport = new StdioClientTransport({
        command: process.execPath,
        args: [path.join(pluginDir, 'server/index.cjs')],
        env: {
            GITHUBSTARS_API_URL: apiUrl,
        },
        stderr: 'pipe',
    })

    try {
        await client.connect(transport)
        const result = await client.callTool({
            name: 'stats-overview',
            arguments: {},
        })

        assert.notEqual(result.isError, true)
        assert.ok(Array.isArray(result.content))

        const textContent = result.content.find((item) => item.type === 'text')
        assert.ok(textContent)

        const response = JSON.parse(textContent.text)
        assert.equal(response.success, true)
        assert.ok(response.data.totalRepos >= 0)
    } finally {
        await client.close()
    }
})
