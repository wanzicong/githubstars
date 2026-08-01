import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(packageDir, '../..')
const pluginDir = path.join(repoRoot, 'plugins/githubstars-agent')
const serverEntry = path.join(pluginDir, 'server/index.cjs')

test('Claude 插件清单应引用自包含 MCP Server 和 Skills', async () => {
    const manifest = JSON.parse(await readFile(path.join(pluginDir, '.claude-plugin/plugin.json'), 'utf8'))
    const mcpConfig = JSON.parse(await readFile(path.join(pluginDir, '.mcp.json'), 'utf8'))
    const marketplace = JSON.parse(await readFile(path.join(repoRoot, '.claude-plugin/marketplace.json'), 'utf8'))

    assert.equal(manifest.name, 'githubstars-agent')
    assert.equal(manifest.mcpServers, './.mcp.json')
    assert.equal(manifest.skills, './skills/')
    assert.equal(mcpConfig.mcpServers.githubstars.command, 'node')
    assert.deepEqual(mcpConfig.mcpServers.githubstars.args, ['${CLAUDE_PLUGIN_ROOT}/server/index.cjs'])
    assert.equal(marketplace.plugins[0].source, './plugins/githubstars-agent')

    const skillFiles = [
        'acquire-star-source',
        'analyze-star-library',
        'localize-star-repositories',
        'manage-star-library',
        'operate-githubstars',
    ]
    for (const skillName of skillFiles) {
        const skill = await readFile(path.join(pluginDir, 'skills', skillName, 'SKILL.md'), 'utf8')
        assert.match(skill, /mcp__plugin_githubstars-agent_githubstars__\*/)
        assert.doesNotMatch(skill, /mcp__githubstars__\*/)
    }

    const dockerfile = await readFile(path.join(repoRoot, 'Dockerfile.backend'), 'utf8')
    assert.match(dockerfile, /COPY --from=pruner \/app\/plugins\/githubstars-agent \.\/agent-plugin/)
})

test('插件 MCP Server 应能独立启动并注册完整工具集', async () => {
    const client = new Client({ name: 'githubstars-plugin-test', version: '1.0.0' }, { capabilities: {} })
    const transport = new StdioClientTransport({
        command: process.execPath,
        args: [serverEntry],
        env: {
            GITHUBSTARS_API_URL: 'http://127.0.0.1:9',
        },
        stderr: 'pipe',
    })

    try {
        await client.connect(transport)
        const result = await client.listTools()
        const names = new Set(result.tools.map((tool) => tool.name))

        assert.equal(result.tools.length, 71)
        assert.ok(names.has('stars-list'))
        assert.ok(names.has('category-tree'))
        assert.ok(names.has('localization-pending'))
        assert.ok(names.has('localization-update'))
        assert.ok(!names.has('localization-batch'))
        assert.ok(names.has('clone-create'))
        assert.ok(names.has('download-create'))
        assert.ok(names.has('sync-status'))
    } finally {
        await client.close()
    }
})
